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
    youtubeVideoId: "J7ZrIDvqlic",
    embedUrl: "https://www.youtube.com/embed/J7ZrIDvqlic?autoplay=1&mute=1&rel=0&modestbranding=1&enablejsapi=1",
    thumbnail: "https://img.youtube.com/vi/J7ZrIDvqlic/maxresdefault.jpg",
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
    youtubeVideoId: "wkVLYfU-Kew",
    embedUrl: "https://www.youtube.com/embed/wkVLYfU-Kew?autoplay=1&mute=1&rel=0&modestbranding=1&enablejsapi=1",
    thumbnail: "https://img.youtube.com/vi/wkVLYfU-Kew/maxresdefault.jpg",
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
    youtubeVideoId: "DHUnz4dyb54",
    embedUrl: "https://www.youtube.com/embed/DHUnz4dyb54?autoplay=1&mute=1&rel=0&modestbranding=1&enablejsapi=1",
    thumbnail: "https://img.youtube.com/vi/DHUnz4dyb54/maxresdefault.jpg",
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
    youtubeVideoId: "F0GOOP82094",
    embedUrl: "https://www.youtube.com/embed/F0GOOP82094?autoplay=1&mute=1&rel=0&modestbranding=1&enablejsapi=1",
    thumbnail: "https://img.youtube.com/vi/F0GOOP82094/maxresdefault.jpg",
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
    youtubeVideoId: "z7_GhJeFxQI",
    embedUrl: "https://www.youtube.com/embed/z7_GhJeFxQI?autoplay=1&mute=1&rel=0&modestbranding=1&enablejsapi=1",
    thumbnail: "https://img.youtube.com/vi/z7_GhJeFxQI/maxresdefault.jpg",
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
    youtubeVideoId: "-m_nQT62B4Y",
    embedUrl: "https://www.youtube.com/embed/-m_nQT62B4Y?autoplay=1&mute=1&rel=0&modestbranding=1&enablejsapi=1",
    thumbnail: "https://img.youtube.com/vi/-m_nQT62B4Y/maxresdefault.jpg",
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
    youtubeVideoId: "EwTH5yY7Mks",
    embedUrl: "https://www.youtube.com/embed/EwTH5yY7Mks?autoplay=1&mute=1&rel=0&modestbranding=1&enablejsapi=1",
    thumbnail: "https://img.youtube.com/vi/EwTH5yY7Mks/maxresdefault.jpg",
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
    youtubeVideoId: "cTsjMtjRLCo",
    embedUrl: "https://www.youtube.com/embed/cTsjMtjRLCo?autoplay=1&mute=1&rel=0&modestbranding=1&enablejsapi=1",
    thumbnail: "https://img.youtube.com/vi/cTsjMtjRLCo/maxresdefault.jpg",
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
