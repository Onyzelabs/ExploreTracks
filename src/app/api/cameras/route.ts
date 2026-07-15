/**
 * GET /api/cameras
 *
 * Returns explore.org live camera data.
 *
 * Strategy:
 *  1. If YOUTUBE_API_KEY is present, fetch the current active live streams
 *     from the official Explore Live Nature Cams channel.
 *  2. Map the dynamic video IDs to known GPS coordinates using a title heuristics table.
 *  3. Fallback to SEED_CAMERAS if the API key is missing or the API call fails.
 */

import { unstable_cache } from "next/cache";
import type { ExploreCamera } from "@/lib/types";
import { ExploreCameraSchema } from "@/lib/types";
import { withErrorHandler } from "@/lib/api-utils";
import exploreChannels from "@/data/explore-channels.json";

// ─── Known Locations Dictionary ─────────────────────────────────────────────
// Maps keywords in YouTube titles to GPS coordinates and categories.
const LOCATION_DICTIONARY = [
  {
    keywords: ["katmai", "brooks falls", "river watch", "riffles"],
    location: "Katmai National Park, Alaska",
    country: "United States",
    coordinates: [-155.0547, 58.4596],
    category: "bears",
  },
  {
    keywords: ["decorah"],
    location: "Decorah, Iowa",
    country: "United States",
    coordinates: [-91.7854, 43.3017],
    category: "birds",
  },
  {
    keywords: ["manatee"],
    location: "Homosassa Springs, Florida",
    country: "United States",
    coordinates: [-82.5765, 28.8],
    category: "marine",
  },
  {
    keywords: ["tropical reef", "aquarium", "coral"],
    location: "Aquarium of the Pacific, CA",
    country: "United States",
    coordinates: [-118.1937, 33.7621],
    category: "marine",
  },
  {
    keywords: ["puffin", "seal island"],
    location: "Seal Island, Maine",
    country: "United States",
    coordinates: [-68.7411, 43.8906],
    category: "birds",
  },
  {
    keywords: ["wolf", "wolves"],
    location: "Ely, Minnesota",
    country: "United States",
    coordinates: [-91.8671, 47.9032],
    category: "mammals",
  },
  {
    keywords: ["anan bear"],
    location: "Wrangell, Alaska",
    country: "United States",
    coordinates: [-131.8596, 56.1772],
    category: "bears",
  },
  {
    keywords: ["kitten rescue", "kitten"],
    location: "Los Angeles, California",
    country: "United States",
    coordinates: [-118.2437, 34.0522],
    category: "mammals",
  },
  {
    keywords: ["polar bear", "churchill"],
    location: "Churchill, Manitoba",
    country: "Canada",
    coordinates: [-94.1656, 58.7684],
    category: "bears",
  },
  {
    keywords: ["black eagle"],
    location: "Roodekrans, South Africa",
    country: "South Africa",
    coordinates: [27.833, -26.083],
    category: "birds",
  },
  {
    keywords: [
      "africa",
      "watering hole",
      "tau",
      "tembe",
      "nkorho",
      "olifants",
      "rosie",
      "masai mara",
      "boteti",
      "naledi",
    ],
    location: "Africa",
    country: "Multiple",
    coordinates: [32.4657, -27.0167],
    category: "african",
  },
  {
    keywords: ["two harbors", "catalina", "west end"],
    location: "Catalina Island, California",
    country: "United States",
    coordinates: [-118.498, 33.438],
    category: "birds",
  },
  {
    keywords: ["philippine eagle"],
    location: "Mindanao, Philippines",
    country: "Philippines",
    coordinates: [125.1716, 7.1907],
    category: "birds",
  },
  {
    keywords: ["fraser point", "sauces", "channel islands"],
    location: "Channel Islands National Park, CA",
    country: "United States",
    coordinates: [-119.8, 34.0],
    category: "birds",
  },
  {
    keywords: ["audubon", "osprey"],
    location: "Hog Island, Maine",
    country: "United States",
    coordinates: [-69.329, 43.957],
    category: "birds",
  },
  {
    keywords: ["dog", "puppy", "service dog", "warrior canine", "ecad"],
    location: "Various Locations",
    country: "United States",
    coordinates: [-95.7129, 37.0902],
    category: "mammals",
  },
  {
    keywords: ["cat", "kitten", "feline", "tiger", "lion"],
    location: "Various Locations",
    country: "United States",
    coordinates: [-95.7129, 38.0902],
    category: "mammals",
  },
  {
    keywords: ["reef", "ocean", "underwater"],
    location: "Ocean",
    country: "International Waters",
    coordinates: [0, 0],
    category: "marine",
  },
];

// Fallback metadata if a stream title doesn't match the dictionary
const DEFAULT_META = {
  location: "Explore.org Global Network",
  country: "Unknown",
  coordinates: [0, 0] as [number, number],
  category: "general" as const,
};

// ─── Curated seed data (Fallback) ─────────────────────────────────────────────

const SEED_CAMERAS: ExploreCamera[] = [
  {
    id: "cam-katmai-brooks-falls",
    name: "Katmai Brown Bear Cam",
    location: "Katmai National Park, Alaska",
    country: "United States",
    coordinates: [-155.0547, 58.4596],
    youtubeVideoId: "J7ZrIDvqlic",
    embedUrl:
      "https://www.youtube.com/embed/J7ZrIDvqlic?autoplay=1&rel=0&modestbranding=1&enablejsapi=1",
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
    embedUrl:
      "https://www.youtube.com/embed/GGIE1E-kaMQ?autoplay=1&rel=0&modestbranding=1&enablejsapi=1",
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
    coordinates: [-82.5765, 28.8],
    youtubeVideoId: "Fz6sl9YJZE0",
    embedUrl:
      "https://www.youtube.com/embed/Fz6sl9YJZE0?autoplay=1&rel=0&modestbranding=1&enablejsapi=1",
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
    embedUrl:
      "https://www.youtube.com/embed/DHUnz4dyb54?autoplay=1&rel=0&modestbranding=1&enablejsapi=1",
    thumbnail: "https://img.youtube.com/vi/DHUnz4dyb54/maxresdefault.jpg",
    isLive: true,
    category: "marine",
    description: "Beautiful tropical reef habitat featuring colorful fish.",
  },
].filter((c) => ExploreCameraSchema.safeParse(c).success);

// ─── Fetch + merge logic ─────────────────────────────────────────────────────

const EXPLORE_CHANNEL_ID = "UC8NnosPOvXnm0O1u5YnLQiw";

const fetchCameras = unstable_cache(
  async (): Promise<ExploreCamera[]> => {
    const API_KEY = process.env.YOUTUBE_API_KEY;

    if (!API_KEY) {
      console.warn(
        "[API/Cameras] YOUTUBE_API_KEY not configured. Falling back to SEED_CAMERAS.",
      );
      return SEED_CAMERAS;
    }

    try {
      // Fetch live streams from all known explore.org channels concurrently
      const promises = exploreChannels.map((channel) =>
        fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channel.id}&eventType=live&type=video&maxResults=20&key=${API_KEY}`,
        )
          .then((res) => (res.ok ? res.json() : null))
          .catch(() => null),
      );

      const results = await Promise.all(promises);

      let allItems: any[] = [];
      results.forEach((data) => {
        if (data && data.items && Array.isArray(data.items)) {
          allItems = allItems.concat(data.items);
        }
      });

      if (allItems.length === 0) {
        return SEED_CAMERAS; // Fallback
      }

      const dynamicCameras: ExploreCamera[] = allItems.map((item: any) => {
        const title = item.snippet.title;
        const videoId = item.id.videoId;

        // Find matching metadata from dictionary
        const titleLower = title.toLowerCase();
        let meta = LOCATION_DICTIONARY.find((m) =>
          m.keywords.some((k) => titleLower.includes(k)),
        );

        // If no match, scatter them slightly off the US West Coast instead of Null Island
        // so they don't perfectly overlap and the user can see them.
        const hash = videoId
          .split("")
          .reduce((acc, char) => acc + char.charCodeAt(0), 0);

        let coords: [number, number];
        if (meta) {
          // Add a tiny jitter so multiple cameras at the same location don't perfectly overlap
          const jitterX = ((hash % 20) - 10) * 0.005;
          const jitterY = (((hash * 3) % 20) - 10) * 0.005;
          coords = [
            meta.coordinates[0] + jitterX,
            meta.coordinates[1] + jitterY,
          ];
        } else {
          meta = DEFAULT_META;
          // Scatter widely in the Pacific Ocean for unknown cameras
          const offsetX = (hash % 40) - 20;
          const offsetY = ((hash * 7) % 20) - 10;
          coords = [-140 + offsetX, 30 + offsetY];
        }

        return {
          id: `cam-${videoId}`,
          name: title
            .replace(/powered by explore\.org/i, "")
            .replace(/\| explore\.org/i, "")
            .trim(),
          location: meta.location,
          country: meta.country,
          coordinates: coords,
          youtubeVideoId: videoId,
          embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&enablejsapi=1`,
          thumbnail:
            item.snippet.thumbnails.high?.url ||
            item.snippet.thumbnails.default?.url,
          isLive: true,
          category: meta.category,
          description:
            item.snippet.description ||
            "Live wildlife stream from explore.org.",
        };
      });

      // Filter valid ones
      return dynamicCameras.filter(
        (c) => ExploreCameraSchema.safeParse(c).success,
      );
    } catch (err) {
      console.error("[API/Cameras] Failed to fetch dynamic cameras:", err);
      return SEED_CAMERAS;
    }
  },
  ["explore-cameras-v8"],
  { revalidate: 900, tags: ["cameras"] }, // Revalidate every 15 mins to catch new streams
);

export const GET = withErrorHandler(async () => {
  const cameras = await fetchCameras();
  return Response.json(
    {
      success: true,
      data: cameras,
      total: cameras.length,
      cachedAt: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=60",
      },
    },
  );
});
