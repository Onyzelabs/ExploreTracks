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

import * as z from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import * as readline from "readline";
import { Readable } from "stream";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config(); // fallback to .env
import type { AnimalTrack, AnimalType } from "../src/lib/types";
import { AnimalTrackSchema } from "../src/lib/types";

/**
 * Infer animal type from species/taxon name for filter categorization.
 */
function inferAnimalType(species: string): AnimalType {
  const s = species.toLowerCase();
  if (
    /aves|accipiter|pandion|aquila|haliaeetus|grus|ciconia|anser|falco|strix/.test(
      s,
    )
  )
    return "bird";
  if (/cetacea|megaptera|balaenoptera|delphin|orca|physeter/.test(s))
    return "marine_mammal";
  if (
    /carcharodon|isurus|sphyrna|rhincodon|shark|thunnus|gadus|anguilla/.test(s)
  )
    return "fish";
  if (/ursus|ailuropoda/.test(s)) return "bear";
  if (/reptilia|testudines|caretta|chelonia|crocodyl|iguana|varanus/.test(s))
    return "reptile";
  if (/lepidoptera|apis|bombus|danaus/.test(s)) return "insect";
  if (
    /mammalia|loxodonta|panthera|acinonyx|equus|cervus|alces|canis|vulpes|odocoileus|rangifer/.test(
      s,
    )
  )
    return "mammal";
  return "unknown";
}

const MOVEBANK_BASE = "https://www.movebank.org/movebank/service/direct-read";

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function fetchWithRetry(url: string, init?: RequestInit, retries = 8): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, init);
    if (res.status === 429) {
      if (i === retries - 1) return res;
      const waitTime = 10000 * (i + 1) + Math.random() * 2000;
      console.log(`[HTTP 429] Rate limited by Movebank. Retrying in ${Math.round(waitTime / 1000)}s...`);
      await delay(waitTime);
      continue;
    }
    return res;
  }
  return fetch(url, init);
}

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
      { longitude: -7.0, latitude: 36.0, timestamp: 1700000000000 },
      { longitude: 0.5, latitude: 40.5, timestamp: 1700200000000 },
      { longitude: 5.1, latitude: 44.8, timestamp: 1700400000000 },
      { longitude: 9.2, latitude: 47.9, timestamp: 1700600000000 },
      { longitude: 13.4, latitude: 52.5, timestamp: 1700800000000 },
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
      { longitude: 0.0, latitude: -55.0, timestamp: 1700000000000 },
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

// Movebank event (GPS fix) shape from the API (CSV headers use underscores)
const MovebankEventSchema = z.object({
  individual_local_identifier: z.string(),
  location_long: z.coerce.number(),
  location_lat: z.coerce.number(),
  timestamp: z.string(), // ISO 8601 or YYYY-MM-DD HH:MM:SS
  individual_taxon_canonical_name: z.string().optional(),
  ground_speed: z.coerce.number().optional(),
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
function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing environment variable: ${key}`);
  return val;
}

function movebankAuthHeader(): string {
  const user = process.env.MOVEBANK_USERNAME;
  const pass = process.env.MOVEBANK_PASSWORD;
  if (!user || !pass) {
    throw new Error("MOVEBANK_USERNAME and MOVEBANK_PASSWORD required");
  }
  return "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
}

/**
 * Parse a single CSV line honoring quotes.
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

/**
 * Fetch all events for a single Movebank study.
 * Requests the last 30 days of data, ordered by timestamp ascending.
 */
async function fetchStudyEvents(
  studyId: number,
  authHeader: string,
): Promise<MovebankEvent[]> {
  const params = new URLSearchParams({
    entity_type: "event",
    study_id: studyId.toString(),
    attributes:
      "individual_local_identifier,location_long,location_lat,timestamp,ground_speed",
    _cb: Date.now().toString(),
  });

  const res = await fetchWithRetry(`${MOVEBANK_BASE}?${params}`, {
    headers: {
      Authorization: authHeader,
      Accept: "application/json",
    },
  });

  if (res.status === 401) {
    throw new Error("Movebank authentication failed. Check MOVEBANK_USERNAME and MOVEBANK_PASSWORD.");
  }
  if (res.status === 403) {
    throw new Error(`Access denied for Movebank study ${studyId}. You may need to accept the data license.`);
  }
  if (!res.ok) {
    throw new Error(`Movebank returned HTTP ${res.status} for study ${studyId}`);
  }

  const raw: Record<string, any>[] = [];
  const rl = readline.createInterface({
    input: Readable.fromWeb(res.body as any),
    crlfDelay: Infinity,
  });

  let headers: string[] = [];
  let isFirst = true;

  // Track seen days per individual to downsample during stream parsing (prevents OOM)
  const seenDaysByInd = new Map<string, Set<string>>();

  for await (const line of rl) {
    if (!line.trim()) continue;
    if (isFirst) {
      headers = line.split(",").map((h) => h.trim());
      isFirst = false;
      continue;
    }
    const values = parseCsvLine(line);
    const obj: Record<string, any> = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] ? values[i].replace(/^"|"$/g, "") : undefined;
    });
    if (obj.location_long && obj.location_lat && obj.individual_local_identifier && obj.timestamp) {
      const indId = obj.individual_local_identifier;
      const dateStr = obj.timestamp.substring(0, 10); // Extract YYYY-MM-DD

      let seenDays = seenDaysByInd.get(indId);
      if (!seenDays) {
        seenDays = new Set<string>();
        seenDaysByInd.set(indId, seenDays);
      }

      if (!seenDays.has(dateStr)) {
        seenDays.add(dateStr);
        raw.push(obj);
      }
    }
  }

  const parsed = raw.map((item) => MovebankEventSchema.safeParse(item));
  const failed = parsed.filter((r) => !r.success);
  if (failed.length > 0) {
    console.error(
      "[/api/tracks] Parse error on first failed item:",
      failed[0].error,
      "Raw item:",
      raw[parsed.indexOf(failed[0])],
    );
  }

  return parsed
    .filter((r) => r.success)
    .map((r) => (r as { success: true; data: MovebankEvent }).data);
}

/**
 * Fetch study metadata (name, etc.) for a given study ID.
 */
async function fetchStudyMeta(
  studyId: number,
  authHeader: string,
): Promise<{ name: string }> {
  const params = new URLSearchParams({
    entity_type: "study",
    id: studyId.toString(),
  });

  const res = await fetchWithRetry(`${MOVEBANK_BASE}?${params}`, {
    headers: { Authorization: authHeader },
  });

  if (!res.ok) return { name: `Study ${studyId}` };

  const text = await res.text();
  const lines = text.trim().split("\n");
  if (lines.length < 2) return { name: `Study ${studyId}` };

  const headers = lines[0].split(",").map((h) => h.trim());
  const nameIdx = headers.indexOf("name");

  if (nameIdx !== -1) {
    const values = parseCsvLine(lines[1]);
    const name = values[nameIdx]
      ? values[nameIdx].replace(/^"|"$/g, "")
      : `Study ${studyId}`;
    return { name };
  }

  return { name: `Study ${studyId}` };
}

/**
 * Fetch individuals metadata to resolve actual species and names
 */
async function fetchStudyIndividuals(
  studyId: number,
  authHeader: string,
): Promise<Map<string, { species: string; name: string }>> {
  const params = new URLSearchParams({
    entity_type: "individual",
    study_id: studyId.toString(),
  });

  const res = await fetchWithRetry(`${MOVEBANK_BASE}?${params}`, {
    headers: { Authorization: authHeader },
  });

  const map = new Map<string, { species: string; name: string }>();
  if (!res.ok) {
    throw new Error(`Movebank Meta returned HTTP ${res.status} for study ${studyId}`);
  }

  const text = await res.text();
  const lines = text.trim().split("\n");
  if (lines.length < 2) return map;

  const headers = lines[0].split(",").map((h) => h.trim());
  const localIdIdx = headers.indexOf("local_identifier");
  const taxonIdx = headers.indexOf("taxon_canonical_name");
  const nickIdx = headers.indexOf("nick_name");

  if (localIdIdx === -1) return map;

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const localId = values[localIdIdx]?.replace(/^"|"$/g, "");
    if (!localId) continue;

    const taxon =
      taxonIdx !== -1 && values[taxonIdx]
        ? values[taxonIdx].replace(/^"|"$/g, "")
        : "Unknown";
    const nick =
      nickIdx !== -1 && values[nickIdx]
        ? values[nickIdx].replace(/^"|"$/g, "")
        : localId;

    map.set(localId, { species: taxon, name: nick });
  }

  return map;
}

/**
 * Transform raw Movebank events (flat list of GPS fixes) into
 * per-individual AnimalTrack objects, sorted by timestamp ascending.
 */
function groupEventsIntoTracks(
  events: MovebankEvent[],
  individuals: Map<string, { species: string; name: string }>,
  studyId: number,
  studyName: string,
  colorOffset: number,
): AnimalTrack[] {
  const byIndividual = new Map<string, MovebankEvent[]>();

  for (const evt of events) {
    const key = evt.individual_local_identifier;
    if (!byIndividual.has(key)) byIndividual.set(key, []);
    byIndividual.get(key)!.push(evt);
  }

  const tracks: AnimalTrack[] = [];
  let i = 0;

  for (const [name, evts] of byIndividual.entries()) {
    // Limit to 15 individuals per study to prevent map domination
    if (tracks.length >= 15) break;

    // Ensure we have valid events
    if (evts.length === 0) continue;

    // Sort by timestamp
    const sorted = evts
      .map((e) => ({
        longitude: e.location_long,
        latitude: e.location_lat,
        timestamp: new Date(e.timestamp).getTime(),
        speed: e.ground_speed,
      }))
      .filter(
        (e) => !isNaN(e.longitude) && !isNaN(e.latitude) && !isNaN(e.timestamp),
      )
      .sort((a, b) => a.timestamp - b.timestamp);

    if (sorted.length === 0) continue;

    // Downsample to 1 point per day across the entire history
    const dailyPoints: typeof sorted = [];
    const seenDays = new Set<string>();
    for (const pt of sorted) {
      // Create YYYY-MM-DD string
      const dateStr = new Date(pt.timestamp).toISOString().split("T")[0];
      if (!seenDays.has(dateStr)) {
        seenDays.add(dateStr);
        dailyPoints.push(pt);
      }
    }

    if (dailyPoints.length === 0) continue;

    const last = dailyPoints[dailyPoints.length - 1];

    // Resolve real species and name from individual metadata
    const meta = individuals.get(name);
    const species =
      meta?.species && meta.species !== "Unknown"
        ? meta.species
        : (evts[0]?.individual_taxon_canonical_name ?? "Unknown");
    const individualName = meta?.name && meta.name !== name ? meta.name : name;

    const parsed = AnimalTrackSchema.safeParse({
      id: `track-${studyId}-${name.replace(/\s+/g, "-").toLowerCase()}`,
      individualName: individualName,
      species,
      commonName: individualName,
      studyId,
      studyName,
      color: getColor(colorOffset + i),
      animalType: inferAnimalType(species),
      tags: [inferAnimalType(species), "wildlife"],
      currentPosition: [last.longitude, last.latitude],
      coordinates: dailyPoints,
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
async function fetchAllTracks(): Promise<AnimalTrack[]> {
    // If Movebank credentials are not configured, return seed data for development.
    // This allows the app to function without credentials during local development.
    if (!process.env.MOVEBANK_USERNAME || !process.env.MOVEBANK_STUDY_IDS) {
      console.warn(
        "[/api/tracks] Movebank env vars not set — returning seed data.",
      );
      return SEED_TRACKS;
    }

    const studyIdsRaw = requireEnv("MOVEBANK_STUDY_IDS");
    const studyIds = studyIdsRaw
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n));

    if (studyIds.length === 0) {
      throw new Error("MOVEBANK_STUDY_IDS is empty or invalid.");
    }

    const authHeader = movebankAuthHeader();
    const allTracks: AnimalTrack[] = [];
    let colorOffset = 0;

    for (const studyId of studyIds) {
      try {
        // Fetch sequentially to strictly avoid HTTP 429 Too Many Requests
        const meta = await fetchStudyMeta(studyId, authHeader);
        await delay(2000);
        const individuals = await fetchStudyIndividuals(studyId, authHeader);
        await delay(2000);
        const events = await fetchStudyEvents(studyId, authHeader);
        const studyName = meta.name;
      const tracks = groupEventsIntoTracks(
        events,
        individuals,
        studyId,
        studyName,
        colorOffset,
      );
      allTracks.push(...tracks);
      colorOffset += tracks.length;
      
      // Delay between studies to be extra safe
      await delay(3000);
    } catch (err) {
      console.error("[/api/tracks] Study fetch failed:", err);
    }
  }

    return allTracks;
}

async function main() {
  console.log("Fetching tracks from Movebank...");
  try {
    const tracks = await fetchAllTracks();
    const outPath = path.join(process.cwd(), "src/data/seed-tracks.json");
    await fs.writeFile(outPath, JSON.stringify(tracks, null, 2));
    console.log(`Successfully wrote ${tracks.length} tracks to ${outPath}`);
  } catch (e) {
    console.error("Failed to update tracks:", e);
    process.exit(1);
  }
}

main();
