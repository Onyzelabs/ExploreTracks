/**
 * GET /api/tracks
 *
 * Proxies the Movebank REST API to retrieve animal tracking data
 * for all configured study IDs. Authenticates via HTTP Basic Auth
 * using server-side env vars (credentials never exposed to client).
 *
 * Movebank API docs: https://www.movebank.org/cms/movebank-content/movebank-api
 *
 * Cache: revalidated every 300 seconds (5 min).
 * GPS collar fixes typically arrive every few minutes to hours.
 */

import { unstable_cache } from "next/cache";
import { z } from "zod";
import type { AnimalTrack, AnimalType } from "@/lib/types";
import { AnimalTrackSchema } from "@/lib/types";
import { ApiError, requireEnv, withErrorHandler } from "@/lib/api-utils";

/**
 * Infer animal type from species/taxon name for filter categorization.
 */
function inferAnimalType(species: string): AnimalType {
  const s = species.toLowerCase();
  if (/aves|accipiter|pandion|aquila|haliaeetus|grus|ciconia|anser|falco|strix/.test(s)) return "bird";
  if (/cetacea|megaptera|balaenoptera|delphin|orca|physeter/.test(s)) return "marine_mammal";
  if (/carcharodon|isurus|sphyrna|rhincodon|shark|thunnus|gadus|anguilla/.test(s)) return "fish";
  if (/ursus|ailuropoda/.test(s)) return "bear";
  if (/reptilia|testudines|caretta|chelonia|crocodyl|iguana|varanus/.test(s)) return "reptile";
  if (/lepidoptera|apis|bombus|danaus/.test(s)) return "insect";
  if (/mammalia|loxodonta|panthera|acinonyx|equus|cervus|alces|canis|vulpes|odocoileus|rangifer/.test(s)) return "mammal";
  return "unknown";
}

const MOVEBANK_BASE = "https://www.movebank.org/movebank/service/direct-read";

// ─── Development seed data ────────────────────────────────────────────────────
// Used when MOVEBANK_USERNAME / MOVEBANK_STUDY_IDS env vars are not configured.
const SEED_TRACKS: AnimalTrack[] = [
  {
    id: "seed-osprey-oskar",
    individualName: "Oskar",
    species: "Pandion haliaetus",
    commonName: "Osprey",
    studyId: 0,
    studyName: "Osprey Migration Europe (seed)",
    color: "#a3e635",
    animalType: "bird",
    tags: ["raptor", "migratory", "Europe"],
    currentPosition: [13.405, 52.52],
    coordinates: [
      { longitude: -7.0,  latitude: 36.0, timestamp: 1700000000000 },
      { longitude:  0.5,  latitude: 40.5, timestamp: 1700200000000 },
      { longitude:  5.1,  latitude: 44.8, timestamp: 1700400000000 },
      { longitude:  9.2,  latitude: 47.9, timestamp: 1700600000000 },
      { longitude: 13.4,  latitude: 52.5, timestamp: 1700800000000 },
    ],
  },
  {
    id: "seed-elephant-amara",
    individualName: "Amara",
    species: "Loxodonta africana",
    commonName: "African Elephant",
    studyId: 0,
    studyName: "Savanna Elephant Tracking (seed)",
    color: "#f97316",
    animalType: "mammal",
    tags: ["megafauna", "Africa", "endangered"],
    currentPosition: [35.2, -1.9],
    coordinates: [
      { longitude: 32.5, latitude: -0.5, timestamp: 1700000000000 },
      { longitude: 33.1, latitude: -0.9, timestamp: 1700200000000 },
      { longitude: 33.8, latitude: -1.3, timestamp: 1700400000000 },
      { longitude: 34.5, latitude: -1.6, timestamp: 1700600000000 },
      { longitude: 35.2, latitude: -1.9, timestamp: 1700800000000 },
    ],
  },
  {
    id: "seed-shark-neptune",
    individualName: "Neptune",
    species: "Carcharodon carcharias",
    commonName: "Great White Shark",
    studyId: 0,
    studyName: "OCEARCH Pacific Shark Tracking (seed)",
    color: "#06b6d4",
    animalType: "fish",
    tags: ["marine", "apex predator", "Pacific"],
    currentPosition: [-140.0, 28.0],
    coordinates: [
      { longitude: -118.5, latitude: 34.0, timestamp: 1700000000000 },
      { longitude: -122.0, latitude: 32.0, timestamp: 1700200000000 },
      { longitude: -128.0, latitude: 30.5, timestamp: 1700400000000 },
      { longitude: -135.0, latitude: 29.0, timestamp: 1700600000000 },
      { longitude: -140.0, latitude: 28.0, timestamp: 1700800000000 },
    ],
  },
  {
    id: "seed-polarbear-nanuq",
    individualName: "Nanuq",
    species: "Ursus maritimus",
    commonName: "Polar Bear",
    studyId: 0,
    studyName: "Hudson Bay Polar Bear Tracking (seed)",
    color: "#e0f2fe",
    animalType: "bear",
    tags: ["arctic", "endangered", "sea ice"],
    currentPosition: [-94.17, 60.5],
    coordinates: [
      { longitude: -94.2, latitude: 58.7, timestamp: 1700000000000 },
      { longitude: -94.5, latitude: 59.1, timestamp: 1700200000000 },
      { longitude: -94.3, latitude: 59.6, timestamp: 1700400000000 },
      { longitude: -94.0, latitude: 60.0, timestamp: 1700600000000 },
      { longitude: -94.2, latitude: 60.5, timestamp: 1700800000000 },
    ],
  },
  {
    id: "seed-albatross-wanderer",
    individualName: "Wanderer",
    species: "Diomedea exulans",
    commonName: "Wandering Albatross",
    studyId: 0,
    studyName: "Southern Ocean Albatross Tracking (seed)",
    color: "#e879f9",
    animalType: "bird",
    tags: ["seabird", "Southern Ocean", "long-range"],
    currentPosition: [60.0, -45.0],
    coordinates: [
      { longitude:  0.0, latitude: -55.0, timestamp: 1700000000000 },
      { longitude: 20.0, latitude: -50.0, timestamp: 1700200000000 },
      { longitude: 40.0, latitude: -47.0, timestamp: 1700400000000 },
      { longitude: 55.0, latitude: -44.0, timestamp: 1700600000000 },
      { longitude: 60.0, latitude: -45.0, timestamp: 1700800000000 },
    ],
  },
  {
    id: "seed-turtle-maya",
    individualName: "Maya",
    species: "Caretta caretta",
    commonName: "Loggerhead Sea Turtle",
    studyId: 0,
    studyName: "Mediterranean Turtle Migration (seed)",
    color: "#34d399",
    animalType: "reptile",
    tags: ["sea turtle", "Mediterranean", "endangered"],
    currentPosition: [18.0, 37.0],
    coordinates: [
      { longitude: 28.0, latitude: 36.5, timestamp: 1700000000000 },
      { longitude: 24.0, latitude: 36.8, timestamp: 1700200000000 },
      { longitude: 20.0, latitude: 37.0, timestamp: 1700400000000 },
      { longitude: 18.0, latitude: 37.0, timestamp: 1700600000000 },
    ],
  },
];


// Movebank event (GPS fix) shape from the API
const MovebankEventSchema = z.object({
  "individual-local-identifier": z.string(),
  "location-long": z.coerce.number(),
  "location-lat": z.coerce.number(),
  timestamp: z.string(), // ISO 8601
  "individual-taxon-canonical-name": z.string().optional(),
  "ground-speed": z.coerce.number().optional(),
  height: z.coerce.number().optional(),
});

const MovebankIndividualSchema = z.object({
  id: z.coerce.number(),
  "local-identifier": z.string(),
  "taxon-canonical-name": z.string().optional(),
  "nick-name": z.string().optional(),
});

const MovebankStudySchema = z.object({
  id: z.coerce.number(),
  name: z.string(),
});

type MovebankEvent = z.infer<typeof MovebankEventSchema>;

// Deterministic color palette for animals (cycles through if more than palette length)
const TRACK_COLORS = [
  "#f97316", // orange
  "#06b6d4", // cyan
  "#a3e635", // lime
  "#e879f9", // fuchsia
  "#f0f9ff", // ice white (polar bear)
  "#fbbf24", // amber
  "#34d399", // emerald
  "#fb7185", // rose
];

function getColor(index: number): string {
  return TRACK_COLORS[index % TRACK_COLORS.length];
}

/**
 * Build Basic Auth header from Movebank credentials.
 */
function movebankAuthHeader(): string {
  const username = requireEnv("MOVEBANK_USERNAME");
  const password = requireEnv("MOVEBANK_PASSWORD");
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

/**
 * Fetch all events for a single Movebank study.
 * Requests the last 30 days of data, ordered by timestamp ascending.
 */
async function fetchStudyEvents(
  studyId: number,
  authHeader: string
): Promise<MovebankEvent[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .replace("T", " ")
    .slice(0, 19);

  const params = new URLSearchParams({
    entity_type: "event",
    study_id: studyId.toString(),
    attributes: "individual-local-identifier,location-long,location-lat,timestamp,ground-speed",
    timestamp_start: thirtyDaysAgo,
    format: "json",
  });

  const res = await fetch(`${MOVEBANK_BASE}?${params}`, {
    headers: {
      Authorization: authHeader,
      Accept: "application/json",
    },
    next: { revalidate: 300 },
  });

  if (res.status === 401) {
    throw new ApiError("Movebank authentication failed. Check MOVEBANK_USERNAME and MOVEBANK_PASSWORD.", 401, "MOVEBANK_AUTH");
  }
  if (res.status === 403) {
    throw new ApiError(`Access denied for Movebank study ${studyId}. You may need to accept the data license.`, 403, "MOVEBANK_FORBIDDEN");
  }
  if (!res.ok) {
    throw new ApiError(`Movebank returned HTTP ${res.status} for study ${studyId}`, 502, "UPSTREAM_ERROR");
  }

  const json = await res.json();
  // Movebank wraps data in { "individuals": [...] } or returns array directly
  const raw: unknown[] = Array.isArray(json) ? json : (json.individuals ?? []);

  return raw
    .map((item) => MovebankEventSchema.safeParse(item))
    .filter((r) => r.success)
    .map((r) => (r as { success: true; data: MovebankEvent }).data);
}

/**
 * Fetch study metadata (name, etc.) for a given study ID.
 */
async function fetchStudyMeta(
  studyId: number,
  authHeader: string
): Promise<{ name: string }> {
  const params = new URLSearchParams({
    entity_type: "study",
    study_id: studyId.toString(),
    format: "json",
  });

  const res = await fetch(`${MOVEBANK_BASE}?${params}`, {
    headers: { Authorization: authHeader, Accept: "application/json" },
    next: { revalidate: 86400 }, // Study names change very rarely
  });

  if (!res.ok) return { name: `Study ${studyId}` };

  const json = await res.json();
  const studies = Array.isArray(json) ? json : [json];
  const parsed = MovebankStudySchema.safeParse(studies[0]);
  return { name: parsed.success ? parsed.data.name : `Study ${studyId}` };
}

/**
 * Transform raw Movebank events (flat list of GPS fixes) into
 * per-individual AnimalTrack objects, sorted by timestamp ascending.
 */
function groupEventsIntoTracks(
  events: MovebankEvent[],
  studyId: number,
  studyName: string,
  colorOffset: number
): AnimalTrack[] {
  const byIndividual = new Map<string, MovebankEvent[]>();

  for (const evt of events) {
    const key = evt["individual-local-identifier"];
    if (!byIndividual.has(key)) byIndividual.set(key, []);
    byIndividual.get(key)!.push(evt);
  }

  const tracks: AnimalTrack[] = [];
  let i = 0;

  for (const [name, evts] of byIndividual.entries()) {
    const sorted = evts
      .map((e) => ({
        longitude: e["location-long"],
        latitude: e["location-lat"],
        timestamp: new Date(e.timestamp).getTime(),
        speed: e["ground-speed"],
      }))
      .filter((p) => !isNaN(p.longitude) && !isNaN(p.latitude))
      .sort((a, b) => a.timestamp - b.timestamp);

    if (sorted.length === 0) continue;

    const last = sorted[sorted.length - 1];
    const species = evts[0]?.["individual-taxon-canonical-name"] ?? "Unknown";

    const parsed = AnimalTrackSchema.safeParse({
      id: `track-${studyId}-${name.replace(/\s+/g, "-").toLowerCase()}`,
      individualName: name,
      species,
      commonName: name,
      studyId,
      studyName,
      color: getColor(colorOffset + i),
      animalType: inferAnimalType(species),
      coordinates: sorted,
      currentPosition: [last.longitude, last.latitude] as [number, number],
      tags: [species],
    });

    if (parsed.success) {
      tracks.push(parsed.data);
    }
    i++;
  }

  return tracks;
}

/**
 * Main cached fetcher — aggregates tracks across all configured study IDs.
 */
const fetchAllTracks = unstable_cache(
  async (): Promise<AnimalTrack[]> => {
    // If Movebank credentials are not configured, return seed data for development.
    // This allows the app to function without credentials during local development.
    if (!process.env.MOVEBANK_USERNAME || !process.env.MOVEBANK_STUDY_IDS) {
      console.warn("[/api/tracks] Movebank env vars not set — returning seed data.");
      return SEED_TRACKS;
    }

    const studyIdsRaw = requireEnv("MOVEBANK_STUDY_IDS");
    const studyIds = studyIdsRaw
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n));

    if (studyIds.length === 0) {
      throw new ApiError("MOVEBANK_STUDY_IDS is empty or invalid.", 500, "CONFIG_ERROR");
    }

    const authHeader = movebankAuthHeader();
    const allTracks: AnimalTrack[] = [];
    let colorOffset = 0;

    // Fetch studies in parallel
    const results = await Promise.allSettled(
      studyIds.map(async (studyId) => {
        const [meta, events] = await Promise.all([
          fetchStudyMeta(studyId, authHeader),
          fetchStudyEvents(studyId, authHeader),
        ]);
        return { studyId, studyName: meta.name, events };
      })
    );

    for (const result of results) {
      if (result.status === "rejected") {
        // Log but don't crash — partial data is better than nothing
        console.error("[/api/tracks] Study fetch failed:", result.reason);
        continue;
      }
      const { studyId, studyName, events } = result.value;
      const tracks = groupEventsIntoTracks(events, studyId, studyName, colorOffset);
      allTracks.push(...tracks);
      colorOffset += tracks.length;
    }

    return allTracks;
  },
  ["movebank-tracks"],
  { revalidate: 300, tags: ["tracks"] }
);

export const GET = withErrorHandler(async () => {
  const tracks = await fetchAllTracks();

  return Response.json(
    {
      success: true,
      data: tracks,
      cachedAt: new Date().toISOString(),
      total: tracks.length,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
      },
    }
  );
});
