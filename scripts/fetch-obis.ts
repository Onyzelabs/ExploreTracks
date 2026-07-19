import fs from "fs/promises";
import path from "path";
import { AnimalTrack } from "../src/lib/types";

// OBIS API endpoint
const OBIS_BASE = "https://api.obis.org/v3/occurrence";

interface ObisRecord {
  dataset_id?: string;
  recordedBy?: string;
  decimalLongitude?: number | string;
  decimalLatitude?: number | string;
  eventDate?: string;
  scientificName?: string;
  vernacularName?: string;
}

const DEFAULT_SPECIES = [
  { scientific: "Chelonia mydas", common: "Green Sea Turtle", type: "reptile", color: "#10b981" },
  { scientific: "Dermochelys coriacea", common: "Leatherback Turtle", type: "reptile", color: "#34d399" },
  { scientific: "Megaptera novaeangliae", common: "Humpback Whale", type: "mammal", color: "#0ea5e9" },
  { scientific: "Orcinus orca", common: "Orca (Killer Whale)", type: "mammal", color: "#f8fafc" },
  { scientific: "Physeter macrocephalus", common: "Sperm Whale", type: "mammal", color: "#60a5fa" },
  { scientific: "Tursiops truncatus", common: "Bottlenose Dolphin", type: "mammal", color: "#38bdf8" },
  { scientific: "Carcharodon carcharias", common: "Great White Shark", type: "fish", color: "#94a3b8" },
  { scientific: "Rhincodon typus", common: "Whale Shark", type: "fish", color: "#64748b" },
  { scientific: "Mobula birostris", common: "Giant Manta Ray", type: "fish", color: "#818cf8" },
  { scientific: "Aptenodytes forsteri", common: "Emperor Penguin", type: "bird", color: "#fef08a" },
];

async function fetchObisRecords(scientificName: string): Promise<ObisRecord[]> {
  const query = new URLSearchParams({
    scientificname: scientificName,
    size: "500",
    sort: "eventDate",
  });
  const res = await fetch(`${OBIS_BASE}?${query}`);
  if (!res.ok) throw new Error(`OBIS API failed with status ${res.status}`);
  const data = await res.json();
  return data.results || [];
}

async function main() {
  console.log("Fetching tracks from OBIS...");
  const outPath = path.join(process.cwd(), "src/data/seed-tracks.json");
  
  let existingTracks: AnimalTrack[] = [];
  try {
    const raw = await fs.readFile(outPath, "utf-8");
    existingTracks = JSON.parse(raw);
  } catch (e) {
    console.warn("Could not read existing seed-tracks.json. OBIS will overwrite.");
  }

  // Filter out any old OBIS tracks
  existingTracks = existingTracks.filter((t) => !t.id.startsWith("obis-"));

  for (let i = 0; i < DEFAULT_SPECIES.length; i++) {
    const meta = DEFAULT_SPECIES[i];
    console.log(`  -> Fetching ${meta.common} (${meta.scientific})`);
    
    try {
      const records = await fetchObisRecords(meta.scientific);
      
      // Group by dataset_id or recordedBy to simulate a continuous "track" for a single individual
      const groups = new Map<string, ObisRecord[]>();
      for (const r of records) {
        if (!r.decimalLongitude || !r.decimalLatitude) continue;
        const key = r.dataset_id || r.recordedBy || "unknown";
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(r);
      }

      // Find the group with the most points
      let bestGroup: ObisRecord[] = [];
      for (const group of groups.values()) {
        if (group.length > bestGroup.length) bestGroup = group;
      }

      if (bestGroup.length < 5) {
        console.log(`     Not enough continuous data points for ${meta.common}. Skipping.`);
        continue;
      }

      // Map to coordinates
      const coordinates = bestGroup
        .map((t) => {
          let ts = Date.now() - Math.random() * 1000000;
          if (t.eventDate) {
            const firstDateStr = String(t.eventDate).split("/")[0];
            const parsed = new Date(firstDateStr).getTime();
            if (!isNaN(parsed)) ts = parsed;
          }
          return {
            longitude: typeof t.decimalLongitude === "string" ? parseFloat(t.decimalLongitude) : t.decimalLongitude!,
            latitude: typeof t.decimalLatitude === "string" ? parseFloat(t.decimalLatitude) : t.decimalLatitude!,
            timestamp: ts,
          };
        })
        .sort((a, b) => a.timestamp - b.timestamp)
        // Keep max 50 points so it's a nice trail
        .slice(-50);

      const last = coordinates[coordinates.length - 1];

      const newTrack: AnimalTrack = {
        id: `obis-${meta.scientific.replace(/\s+/g, "-").toLowerCase()}-${i}`,
        individualName: `OBIS ${meta.common.split(" ")[0]}`,
        species: meta.scientific,
        commonName: meta.common,
        studyId: 900000 + i,
        studyName: "OBIS Public Observations",
        color: meta.color,
        animalType: meta.type as any,
        tags: [meta.type, "marine", "obis"],
        currentPosition: [last.longitude, last.latitude],
        coordinates,
      };

      existingTracks.push(newTrack);
      console.log(`     Added ${coordinates.length} points for ${meta.common}.`);
    } catch (err) {
      console.error(`     Failed to fetch ${meta.common}:`, err);
    }
  }

  await fs.writeFile(outPath, JSON.stringify(existingTracks, null, 2));
  console.log(`Successfully appended OBIS tracks. Total tracks: ${existingTracks.length}`);
}

main().catch((err) => {
  console.error("OBIS Fetch Error:", err);
  process.exit(1);
});
