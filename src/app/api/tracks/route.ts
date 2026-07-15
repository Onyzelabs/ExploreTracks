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
import type { AnimalTrack, TrackPoint } from "@/lib/types";
import { AnimalTrackSchema } from "@/lib/types";
import { ApiError, requireEnv, withErrorHandler } from "@/lib/api-utils";

const MOVEBANK_BASE = "https://www.movebank.org/movebank/service/direct-read";

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
