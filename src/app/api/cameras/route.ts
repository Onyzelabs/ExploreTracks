/**
 * GET /api/cameras
 *
 * Scrapes explore.org live cams page to retrieve all active camera feeds.
 * Returns a validated list of ExploreCamera objects with YouTube embed URLs.
 *
 * Cache: revalidated every 3600 seconds (1 hour) via Next.js fetch cache.
 * The camera list changes infrequently; ISR is sufficient.
 */

import { unstable_cache } from "next/cache";
import * as cheerio from "cheerio";
import { z } from "zod";
import type { ExploreCamera } from "@/lib/types";
import { ExploreCameraSchema, CameraCategorySchema } from "@/lib/types";
import { ApiError, withErrorHandler } from "@/lib/api-utils";

const EXPLORE_BASE = process.env.EXPLORE_ORG_BASE_URL ?? "https://explore.org";
const LIVECAMS_URL = `${EXPLORE_BASE}/livecams`;

// YouTube video ID regex
const YT_ID_RE = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=))([A-Za-z0-9_-]{11})/;

/**
 * Derive a camera category from its name/description heuristics.
 */
function inferCategory(name: string, desc: string): ExploreCamera["category"] {
  const text = `${name} ${desc}`.toLowerCase();
  if (/bear|grizzly|polar|brown bear/.test(text)) return "bears";
  if (/elephant|lion|leopard|cheetah|giraffe|zebra|africa|kenya|namibia|south africa/.test(text)) return "african";
  if (/eagle|hawk|owl|heron|bird|nest|raptor|osprey|falcon/.test(text)) return "birds";
  if (/shark|whale|dolphin|sea|ocean|underwater|reef|kelp|otter/.test(text)) return "marine";
  if (/wolf|deer|elk|bison|moose|fox|coyote/.test(text)) return "mammals";
  return "general";
}

/**
 * Fetches and parses explore.org live cam listing.
 * Wrapped in unstable_cache for server-side ISR-style caching.
 */
const fetchCamerasFromExploreOrg = unstable_cache(
  async (): Promise<ExploreCamera[]> => {
    const res = await fetch(LIVECAMS_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ExploreTracks/1.0)",
        Accept: "text/html",
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      throw new ApiError(
        `explore.org returned HTTP ${res.status}`,
        502,
        "UPSTREAM_ERROR"
      );
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const cameras: ExploreCamera[] = [];

    // explore.org renders camera cards as anchor elements linking to /livecams/<slug>
    // Each card typically contains a title, thumbnail, and an embedded YouTube link.
    $("a[href*='/livecams/']").each((_i, el) => {
      try {
        const href = $(el).attr("href") ?? "";
        if (!href.includes("/livecams/")) return;

        const slug = href.split("/livecams/")[1]?.split("?")[0]?.replace(/\/$/, "");
        if (!slug || slug === "") return;

        const id = `cam-${slug}`;
        const name =
          $(el).find("[class*='title'], h2, h3, h4").first().text().trim() ||
          $(el).attr("title") ||
          slug.replace(/-/g, " ");

        // Look for YouTube iframe or data attributes within the card
        const iframeSrc =
          $(el).find("iframe").attr("src") ||
          $(el).attr("data-video-url") ||
          "";

        const ytMatch = iframeSrc.match(YT_ID_RE);
        if (!ytMatch) return; // Skip cards without a YouTube embed

        const youtubeVideoId = ytMatch[1];
        const embedUrl = `https://www.youtube.com/embed/${youtubeVideoId}?autoplay=1&mute=1&enablejsapi=1`;
        const thumbnail = `https://img.youtube.com/vi/${youtubeVideoId}/maxresdefault.jpg`;

        const description =
          $(el).find("[class*='desc'], p").first().text().trim() ||
          `Live cam from ${name}`;

        // Attempt to extract lat/lng from data attributes (explore.org sometimes embeds these)
        const lat = parseFloat($(el).attr("data-lat") ?? "");
        const lng = parseFloat($(el).attr("data-lng") ?? "");
        const coordinates: [number, number] = isNaN(lat) || isNaN(lng) ? [0, 0] : [lng, lat];

        const country =
          $(el).find("[class*='location'], [class*='country']").first().text().trim() ||
          "Unknown";

        const category = inferCategory(name, description);

        const parsed = ExploreCameraSchema.safeParse({
          id,
          name,
          location: name,
          country,
          coordinates,
          youtubeVideoId,
          embedUrl,
          thumbnail,
          isLive: true,
          category,
          description,
        });

        if (parsed.success) {
          cameras.push(parsed.data);
        }
      } catch {
        // Skip malformed cards silently
      }
    });

    if (cameras.length === 0) {
      throw new ApiError(
        "No camera data could be extracted from explore.org. The page structure may have changed.",
        502,
        "PARSE_ERROR"
      );
    }

    return cameras;
  },
  ["explore-org-cameras"],
  { revalidate: 3600, tags: ["cameras"] }
);

export const GET = withErrorHandler(async () => {
  const cameras = await fetchCamerasFromExploreOrg();

  return Response.json(
    {
      success: true,
      data: cameras,
      cachedAt: new Date().toISOString(),
      total: cameras.length,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=300",
      },
    }
  );
});
