/**
 * GET /api/yt-chat/[videoId]
 *
 * Proxies YouTube Data API v3 liveChatMessages.list for a given video.
 * Returns the latest batch of chat messages for the danmaku feed.
 *
 * Flow:
 *  1. Resolve the video's activeLiveChatId from videos.list
 *  2. Fetch the latest messages from liveChatMessages.list
 *  3. Return normalized LiveChatMessage[] to the client
 *
 * The client should poll this endpoint on the interval specified in
 * the response's `pollingIntervalMillis` field (typically 5000–15000ms).
 *
 * No server-side cache — this endpoint is intentionally uncached
 * as it provides real-time data for the danmaku overlay.
 *
 * Auth: YouTube API key passed via YOUTUBE_API_KEY env var (never exposed to client).
 */

import { z } from "zod";
import { ApiError, requireEnv, withErrorHandler } from "@/lib/api-utils";
import type { LiveChatMessage } from "@/lib/types";

const YT_BASE = "https://www.googleapis.com/youtube/v3";

// Minimal YouTube API response schemas
const VideoListSchema = z.object({
  items: z.array(
    z.object({
      liveStreamingDetails: z
        .object({
          activeLiveChatId: z.string().optional(),
        })
        .optional(),
    })
  ),
});

const ChatMessageSchema = z.object({
  id: z.string(),
  snippet: z.object({
    displayMessage: z.string(),
    publishedAt: z.string(),
  }),
  authorDetails: z.object({
    displayName: z.string(),
    profileImageUrl: z.string().url().optional(),
  }),
});

const ChatResponseSchema = z.object({
  items: z.array(ChatMessageSchema),
  pollingIntervalMillis: z.number().optional(),
  nextPageToken: z.string().optional(),
});

/**
 * Resolves the active live chat ID for a YouTube video.
 * Returns null if the video is not a live stream.
 */
async function resolveActiveChatId(
  videoId: string,
  apiKey: string
): Promise<string | null> {
  const params = new URLSearchParams({
    part: "liveStreamingDetails",
    id: videoId,
    key: apiKey,
  });

  const res = await fetch(`${YT_BASE}/videos?${params}`, {
    next: { revalidate: 60 }, // Cache chat ID for 60s — it rarely changes mid-stream
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      `YouTube videos.list failed: ${body?.error?.message ?? res.status}`,
      502,
      "YT_API_ERROR"
    );
  }

  const parsed = VideoListSchema.safeParse(await res.json());
  if (!parsed.success) return null;

  return parsed.data.items[0]?.liveStreamingDetails?.activeLiveChatId ?? null;
}

/**
 * Fetches the latest live chat messages for a given liveChatId.
 */
async function fetchChatMessages(
  liveChatId: string,
  apiKey: string,
  pageToken?: string
): Promise<{ messages: LiveChatMessage[]; pollingIntervalMillis: number; nextPageToken?: string }> {
  const params = new URLSearchParams({
    part: "snippet,authorDetails",
    liveChatId,
    maxResults: "200",
    key: apiKey,
    ...(pageToken ? { pageToken } : {}),
  });

  const res = await fetch(`${YT_BASE}/liveChat/messages?${params}`, {
    cache: "no-store", // Always fetch fresh — this is the danmaku feed
  });

  if (res.status === 403) {
    throw new ApiError(
      "YouTube API quota exceeded or access denied. Check your API key restrictions.",
      403,
      "YT_QUOTA_EXCEEDED"
    );
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      `YouTube liveChatMessages.list failed: ${body?.error?.message ?? res.status}`,
      502,
      "YT_API_ERROR"
    );
  }

  const parsed = ChatResponseSchema.safeParse(await res.json());
  if (!parsed.success) {
    return { messages: [], pollingIntervalMillis: 5000 };
  }

  const messages: LiveChatMessage[] = parsed.data.items.map((item) => ({
    id: item.id,
    authorName: item.authorDetails.displayName,
    message: item.snippet.displayMessage,
    timestamp: new Date(item.snippet.publishedAt).getTime(),
    authorPhotoUrl: item.authorDetails.profileImageUrl,
  }));

  return {
    messages,
    pollingIntervalMillis: parsed.data.pollingIntervalMillis ?? 5000,
    nextPageToken: parsed.data.nextPageToken,
  };
}

export const GET = withErrorHandler(async (req, ctx) => {
  const { params } = ctx as { params: Promise<{ videoId: string }> };
  const { videoId } = await params;

  if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
    throw new ApiError("Invalid YouTube video ID format.", 400, "INVALID_VIDEO_ID");
  }

  // If API key is not configured (e.g. local dev without credentials), return
  // an empty response with a long polling interval instead of crashing with 500.
  if (!process.env.YOUTUBE_API_KEY) {
    return Response.json({
      success: true,
      data: { messages: [], pollingIntervalMillis: 60000, isLive: false, unconfigured: true },
    });
  }

  const apiKey = requireEnv("YOUTUBE_API_KEY");
  const { searchParams } = new URL(req.url);
  const pageToken = searchParams.get("pageToken") ?? undefined;

  // Step 1: Resolve live chat ID
  const liveChatId = await resolveActiveChatId(videoId, apiKey);

  if (!liveChatId) {
    // Not a live stream or stream has ended — return empty gracefully
    return Response.json({
      success: true,
      data: { messages: [], pollingIntervalMillis: 30000, isLive: false },
    });
  }

  // Step 2: Fetch messages
  const { messages, pollingIntervalMillis, nextPageToken } =
    await fetchChatMessages(liveChatId, apiKey, pageToken);

  return Response.json(
    {
      success: true,
      data: {
        messages,
        pollingIntervalMillis,
        nextPageToken,
        isLive: true,
      },
    },
    {
      headers: {
        // No CDN caching — danmaku must be real-time
        "Cache-Control": "no-store",
      },
    }
  );
});
