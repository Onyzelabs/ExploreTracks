/**
 * Client-side data fetching hooks using SWR.
 *
 * All hooks consume the internal Next.js API routes, which act as
 * authenticated proxies for external services (Movebank, YouTube, explore.org).
 *
 * Polling intervals:
 *  - cameras:  60 min  (camera list is mostly static)
 *  - tracks:    5 min  (GPS collar resolution)
 *  - yt-chat:  dynamic (driven by YouTube's pollingIntervalMillis)
 */

import useSWR from "swr";
import useSWRImmutable from "swr/immutable";
import { useEffect, useRef, useCallback } from "react";
import type { ExploreCamera, AnimalTrack, LiveChatMessage } from "@/lib/types";

// ─── Generic fetcher ─────────────────────────────────────────────────────────

async function apiFetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const json = await res.json();

  if (!res.ok || !json.success) {
    const err = new Error(json?.error ?? `HTTP ${res.status}`);
    (err as Error & { code?: string }).code = json?.code;
    throw err;
  }

  return json.data as T;
}

// ─── Cameras ─────────────────────────────────────────────────────────────────

interface UseCamerasResult {
  cameras: ExploreCamera[] | undefined;
  isLoading: boolean;
  error: Error | undefined;
  mutate: () => void;
}

export function useCameras(): UseCamerasResult {
  const { data, isLoading, error, mutate } = useSWR<ExploreCamera[]>(
    "/api/cameras",
    apiFetcher,
    {
      refreshInterval: 60 * 60 * 1000, // 1 hour
      revalidateOnFocus: false,
      dedupingInterval: 10 * 60 * 1000, // Dedupe for 10 min
    },
  );

  return { cameras: data, isLoading, error, mutate };
}

// ─── Animal Tracks ────────────────────────────────────────────────────────────

interface UseTracksResult {
  tracks: AnimalTrack[] | undefined;
  isLoading: boolean;
  error: Error | undefined;
  mutate: () => void;
}

export function useTracks(): UseTracksResult {
  const { data, isLoading, error, mutate } = useSWR<AnimalTrack[]>(
    "/api/tracks",
    apiFetcher,
    {
      refreshInterval: 5 * 60 * 1000, // 5 minutes
      revalidateOnFocus: true,
      dedupingInterval: 60 * 1000,
    },
  );

  return { tracks: data, isLoading, error, mutate };
}

// ─── YouTube Live Chat ────────────────────────────────────────────────────────

interface YtChatResponse {
  messages: LiveChatMessage[];
  pollingIntervalMillis: number;
  nextPageToken?: string;
  isLive: boolean;
}

interface UseYtChatOptions {
  /** Called for each new batch of messages (to shoot into danmaku) */
  onMessages: (messages: LiveChatMessage[]) => void;
  enabled?: boolean;
}

/**
 * Polls /api/yt-chat/[videoId] at the interval returned by the YouTube API.
 * Fires onMessages callback for each new batch — does not store messages in state
 * to avoid memory growth from accumulating hundreds of chat messages.
 */
export function useYtChat(
  videoId: string | null | undefined,
  { onMessages, enabled = true }: UseYtChatOptions,
) {
  const pageTokenRef = useRef<string | undefined>(undefined);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isLive, setIsLive] = useState(false);
  const onMessagesRef = useRef(onMessages);
  useEffect(() => {
    onMessagesRef.current = onMessages;
  }, [onMessages]);

  const poll = useCallback(async () => {
    if (!videoId || !enabled) return;

    try {
      const url = new URL(`/api/yt-chat/${videoId}`, window.location.origin);
      if (pageTokenRef.current) {
        url.searchParams.set("pageToken", pageTokenRef.current);
      }

      const res = await fetch(url.toString());
      const json: { success: boolean; data?: YtChatResponse; error?: string } =
        await res.json();

      if (!json.success || !json.data) return;

      const { messages, pollingIntervalMillis, nextPageToken, isLive: newIsLive } =
        json.data;
      setIsLive(newIsLive);

      if (nextPageToken) {
        pageTokenRef.current = nextPageToken;
      }

      if (messages.length > 0) {
        onMessagesRef.current(messages);
      }

      // Schedule next poll at YouTube-specified interval
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      timerRef.current = setTimeout(() => poll(), pollingIntervalMillis ?? 5000);
    } catch (err) {
      console.error("[useYtChat] Poll failed:", err);
      // Retry after 15s on error to avoid hammering in bad state
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      timerRef.current = setTimeout(() => poll(), 15000);
    }
  }, [videoId, enabled]);

  useEffect(() => {
    if (!videoId || !enabled) return;
    pageTokenRef.current = undefined; // Reset pagination when video changes

    // Start first poll immediately
    poll();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [videoId, enabled, poll]);

  return { isLive };
}
