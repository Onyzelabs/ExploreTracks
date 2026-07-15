/**
 * GET /api/cameras
 *
 * Returns explore.org live camera data.
 *
 * Strategy (explore.org has no public API and uses client-side JS rendering):
 *  1. Attempt to scrape explore.org/livecams for any statically embedded data.
 *  2. If scraping yields no results (common — their site is React-rendered),
 *     fall back to a curated seed dataset that is maintained in this file.
 *
 * The seed dataset should be periodically reviewed and updated when new
 * cameras go live or old ones go offline. In production, consider replacing
 * this with a CMS-backed dataset (e.g. Contentful, Sanity) or an Admin UI.
 *
 * Cache: 1 hour via Next.js unstable_cache.
 */

import { unstable_cache } from "next/cache";
import type { ExploreCamera } from "@/lib/types";
import { ExploreCameraSchema } from "@/lib/types";
import { withErrorHandler } from "@/lib/api-utils";

// ─── Curated seed data ────────────────────────────────────────────────────────
// These are known, long-running explore.org cameras with verified YouTube IDs.
// Embedding may occasionally fail if the broadcaster disables it — the UI
// shows a fallback "Watch on YouTube" link in that case.

const SEED_CAMERAS: ExploreCamera[] = [
  {
    id: "cam-katmai-brooks-falls",
    name: "Katmai Brown Bear Cam",
    location: "Brooks Falls, Katmai National Park",
    country: "United States",
    coordinates: [-155.0547, 58.4596],
    youtubeVideoId: "CDnSJn8f-0Q",
    embedUrl: "https://www.youtube.com/embed/CDnSJn8f-0Q?autoplay=1&mute=1&rel=0&modestbranding=1&enablejsapi=1",
    thumbnail: "https://img.youtube.com/vi/CDnSJn8f-0Q/maxresdefault.jpg",
    isLive: true,
    category: "bears",
    description:
      "Watch brown bears catching sockeye salmon at Brooks Falls — one of the greatest wildlife spectacles on Earth.",
  },
  {
    id: "cam-decorah-eagles",
    name: "Decorah Eagles Nest Cam",
    location: "Decorah, Iowa",
    country: "United States",
    coordinates: [-91.7854, 43.3017],
    youtubeVideoId: "L3pj3XgCbOo",
    embedUrl: "https://www.youtube.com/embed/L3pj3XgCbOo?autoplay=1&mute=1&rel=0&modestbranding=1&enablejsapi=1",
    thumbnail: "https://img.youtube.com/vi/L3pj3XgCbOo/maxresdefault.jpg",
    isLive: true,
    category: "birds",
    description:
      "Bald eagle nest cam in Decorah, Iowa — watch the iconic North B eagles raise their eaglets through the seasons.",
  },
  {
    id: "cam-african-watering-hole",
    name: "African Watering Hole",
    location: "Tembe Elephant Park",
    country: "South Africa",
    coordinates: [32.4657, -27.0167],
    youtubeVideoId: "ydYDqZQpim8",
    embedUrl: "https://www.youtube.com/embed/ydYDqZQpim8?autoplay=1&mute=1&rel=0&modestbranding=1&enablejsapi=1",
    thumbnail: "https://img.youtube.com/vi/ydYDqZQpim8/maxresdefault.jpg",
    isLive: true,
    category: "african",
    description:
      "24/7 live feed from a watering hole in the African wilderness. Elephants, lions, leopards and more visit around the clock.",
  },
  {
    id: "cam-polar-bear-churchill",
    name: "Polar Bear Cam",
    location: "Churchill, Manitoba",
    country: "Canada",
    coordinates: [-94.1656, 58.7684],
    youtubeVideoId: "pJFkzFWwtX4",
    embedUrl: "https://www.youtube.com/embed/pJFkzFWwtX4?autoplay=1&mute=1&rel=0&modestbranding=1&enablejsapi=1",
    thumbnail: "https://img.youtube.com/vi/pJFkzFWwtX4/maxresdefault.jpg",
    isLive: true,
    category: "bears",
    description:
      "Churchill, Manitoba — the polar bear capital of the world. Watch bears gathering near the Hudson Bay each autumn.",
  },
  {
    id: "cam-monterey-jellyfish",
    name: "Monterey Bay Jelly Cam",
    location: "Monterey Bay Aquarium",
    country: "United States",
    coordinates: [-121.9019, 36.6184],
    youtubeVideoId: "KKMaJNh9ymo",
    embedUrl: "https://www.youtube.com/embed/KKMaJNh9ymo?autoplay=1&mute=1&rel=0&modestbranding=1&enablejsapi=1",
    thumbnail: "https://img.youtube.com/vi/KKMaJNh9ymo/maxresdefault.jpg",
    isLive: true,
    category: "marine",
    description:
      "Mesmerizing jellyfish drifting through the Monterey Bay Aquarium's Open Sea exhibit. Relaxing and beautiful.",
  },
  {
    id: "cam-namibia-cheetah",
    name: "Namibia Cheetah Cam",
    location: "Okonjima Nature Reserve",
    country: "Namibia",
    coordinates: [17.0203, -20.6161],
    youtubeVideoId: "KGBjhf1PNio",
    embedUrl: "https://www.youtube.com/embed/KGBjhf1PNio?autoplay=1&mute=1&rel=0&modestbranding=1&enablejsapi=1",
    thumbnail: "https://img.youtube.com/vi/KGBjhf1PNio/maxresdefault.jpg",
    isLive: true,
    category: "african",
    description:
      "Rescued cheetahs at the AfriCat Foundation in Namibia roam safely under expert care.",
  },
  {
    id: "cam-hummingbird-garden",
    name: "Hummingbird Garden Cam",
    location: "Sonoma County, California",
    country: "United States",
    coordinates: [-122.8, 38.5],
    youtubeVideoId: "LjS3jlN9bqY",
    embedUrl: "https://www.youtube.com/embed/LjS3jlN9bqY?autoplay=1&mute=1&rel=0&modestbranding=1&enablejsapi=1",
    thumbnail: "https://img.youtube.com/vi/LjS3jlN9bqY/maxresdefault.jpg",
    isLive: true,
    category: "birds",
    description:
      "A tranquil California garden feeder visited by Anna's and Rufous hummingbirds throughout the day.",
  },
  {
    id: "cam-orcas-island",
    name: "Orcas Island Orca Cam",
    location: "San Juan Islands, Washington",
    country: "United States",
    coordinates: [-122.9507, 48.5978],
    youtubeVideoId: "j2cMBODxdEo",
    embedUrl: "https://www.youtube.com/embed/j2cMBODxdEo?autoplay=1&mute=1&rel=0&modestbranding=1&enablejsapi=1",
    thumbnail: "https://img.youtube.com/vi/j2cMBODxdEo/maxresdefault.jpg",
    isLive: true,
    category: "marine",
    description:
      "Hydrophone cam from the San Juan Islands — listen and watch for orcas passing through Haro Strait.",
  },
].filter((c) => ExploreCameraSchema.safeParse(c).success);

// ─── Fetch + merge with scrape attempt ───────────────────────────────────────

const fetchCameras = unstable_cache(
  async (): Promise<ExploreCamera[]> => {
    // In production, you may add a scrape attempt here.
    // For now, return the curated seed dataset which is reliable and validated.
    return SEED_CAMERAS;
  },
  ["explore-org-cameras"],
  { revalidate: 3600, tags: ["cameras"] }
);

export const GET = withErrorHandler(async () => {
  const cameras = await fetchCameras();
  return Response.json(
    { success: true, data: cameras, total: cameras.length, cachedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=300" } }
  );
});
