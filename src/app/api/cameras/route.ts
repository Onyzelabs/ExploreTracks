/**
 * GET /api/cameras
 *
 * Returns explore.org live camera data.
 */

import { unstable_cache } from "next/cache";
import type { ExploreCamera } from "@/lib/types";
import { ExploreCameraSchema } from "@/lib/types";
import { withErrorHandler } from "@/lib/api-utils";

// ─── Curated seed data ────────────────────────────────────────────────────────

const SEED_CAMERAS: ExploreCamera[] = [
  {
    id: "cam-katmai-brooks-falls",
    name: "Katmai Brown Bear Cam",
    location: "Katmai National Park, Alaska",
    country: "United States",
    coordinates: [-155.0547, 58.4596],
    youtubeVideoId: "J7ZrIDvqlic",
    embedUrl: "https://www.youtube.com/embed/J7ZrIDvqlic?autoplay=1&mute=1&rel=0&modestbranding=1&enablejsapi=1",
    thumbnail: "https://img.youtube.com/vi/J7ZrIDvqlic/maxresdefault.jpg",
    isLive: true,
    category: "bears",
    description: "Watch brown bears catching sockeye salmon at Brooks Falls.",
  },
  {
    id: "cam-decorah-eagles",
    name: "Decorah Eagles Nest Cam",
    location: "Decorah, Iowa",
    country: "United States",
    coordinates: [-91.7854, 43.3017],
    youtubeVideoId: "GGIE1E-kaMQ",
    embedUrl: "https://www.youtube.com/embed/GGIE1E-kaMQ?autoplay=1&mute=1&rel=0&modestbranding=1&enablejsapi=1",
    thumbnail: "https://img.youtube.com/vi/GGIE1E-kaMQ/maxresdefault.jpg",
    isLive: true,
    category: "birds",
    description: "Bald eagle nest cam in Decorah, Iowa.",
  },
  {
    id: "cam-manatee-underwater",
    name: "Underwater Manatee Cam",
    location: "Homosassa Springs, Florida",
    country: "United States",
    coordinates: [-82.5765, 28.8000],
    youtubeVideoId: "Fz6sl9YJZE0",
    embedUrl: "https://www.youtube.com/embed/Fz6sl9YJZE0?autoplay=1&mute=1&rel=0&modestbranding=1&enablejsapi=1",
    thumbnail: "https://img.youtube.com/vi/Fz6sl9YJZE0/maxresdefault.jpg",
    isLive: true,
    category: "marine",
    description: "Watch the beloved sea cows swimming underwater in Florida.",
  },
  {
    id: "cam-tropical-reef",
    name: "Tropical Reef Camera",
    location: "Aquarium of the Pacific, CA",
    country: "United States",
    coordinates: [-118.1937, 33.7621],
    youtubeVideoId: "DHUnz4dyb54",
    embedUrl: "https://www.youtube.com/embed/DHUnz4dyb54?autoplay=1&mute=1&rel=0&modestbranding=1&enablejsapi=1",
    thumbnail: "https://img.youtube.com/vi/DHUnz4dyb54/maxresdefault.jpg",
    isLive: true,
    category: "marine",
    description: "Beautiful tropical reef habitat featuring colorful fish.",
  },
  {
    id: "cam-puffin-ledge",
    name: "Puffin Loafing Ledge",
    location: "Seal Island, Maine",
    country: "United States",
    coordinates: [-68.7411, 43.8906],
    youtubeVideoId: "daFe_ygulPY",
    embedUrl: "https://www.youtube.com/embed/daFe_ygulPY?autoplay=1&mute=1&rel=0&modestbranding=1&enablejsapi=1",
    thumbnail: "https://img.youtube.com/vi/daFe_ygulPY/maxresdefault.jpg",
    isLive: true,
    category: "birds",
    description: "Atlantic puffins resting on the rocky ledges of Seal Island.",
  },
  {
    id: "cam-international-wolf",
    name: "International Wolf Center",
    location: "Ely, Minnesota",
    country: "United States",
    coordinates: [-91.8671, 47.9032],
    youtubeVideoId: "5e4lsEe4Vew",
    embedUrl: "https://www.youtube.com/embed/5e4lsEe4Vew?autoplay=1&mute=1&rel=0&modestbranding=1&enablejsapi=1",
    thumbnail: "https://img.youtube.com/vi/5e4lsEe4Vew/maxresdefault.jpg",
    isLive: true,
    category: "african",
    description: "Watch the ambassador wolves at the International Wolf Center.",
  },
  {
    id: "cam-anan-bear",
    name: "Anan Bear Cam",
    location: "Wrangell, Alaska",
    country: "United States",
    coordinates: [-131.8596, 56.1772],
    youtubeVideoId: "ypMu3yA7h3s",
    embedUrl: "https://www.youtube.com/embed/ypMu3yA7h3s?autoplay=1&mute=1&rel=0&modestbranding=1&enablejsapi=1",
    thumbnail: "https://img.youtube.com/vi/ypMu3yA7h3s/maxresdefault.jpg",
    isLive: true,
    category: "bears",
    description: "Black and brown bears fishing at the Anan Creek observatory.",
  },
  {
    id: "cam-kitten-rescue",
    name: "Kitten Rescue Cam",
    location: "Los Angeles, California",
    country: "United States",
    coordinates: [-118.2437, 34.0522],
    youtubeVideoId: "-m_nQT62B4Y",
    embedUrl: "https://www.youtube.com/embed/-m_nQT62B4Y?autoplay=1&mute=1&rel=0&modestbranding=1&enablejsapi=1",
    thumbnail: "https://img.youtube.com/vi/-m_nQT62B4Y/maxresdefault.jpg",
    isLive: true,
    category: "african",
    description: "Live from a kitten rescue sanctuary. Watch them play and sleep.",
  },
].filter((c) => ExploreCameraSchema.safeParse(c).success);

// ─── Fetch + merge with scrape attempt ───────────────────────────────────────

const fetchCameras = unstable_cache(
  async (): Promise<ExploreCamera[]> => {
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
