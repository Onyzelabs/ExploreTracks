import { AnimalTrack } from "./types";

const OBIS_BASE = "https://api.obis.org/v3/occurrence";

export const OBIS_SPECIES = [
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

export async function fetchDynamicObisTracks(): Promise<AnimalTrack[]> {
  const tracks: AnimalTrack[] = [];
  
  const promises = OBIS_SPECIES.map(async (meta, i) => {
    try {
      const query = new URLSearchParams({
        scientificname: meta.scientific,
        size: "500",
        sort: "eventDate",
      });
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout
      
      const res = await fetch(`${OBIS_BASE}?${query}`, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!res.ok) throw new Error(`OBIS HTTP ${res.status}`);
      const data = await res.json();
      const records = data.results || [];
      
      const groups = new Map<string, any[]>();
      for (const r of records) {
        if (!r.decimalLongitude || !r.decimalLatitude) continue;
        const key = r.dataset_id || r.recordedBy || "unknown";
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(r);
      }

      let bestGroup: any[] = [];
      for (const group of groups.values()) {
        if (group.length > bestGroup.length) bestGroup = group;
      }

      if (bestGroup.length < 5) return;

      const coordinates = bestGroup
        .map((t) => {
          let ts = Date.now() - Math.random() * 1000000;
          if (t.eventDate) {
            const firstDateStr = String(t.eventDate).split("/")[0];
            const parsed = new Date(firstDateStr).getTime();
            if (!isNaN(parsed)) ts = parsed;
          }
          return {
            longitude: typeof t.decimalLongitude === "string" ? parseFloat(t.decimalLongitude) : t.decimalLongitude,
            latitude: typeof t.decimalLatitude === "string" ? parseFloat(t.decimalLatitude) : t.decimalLatitude,
            timestamp: ts,
          };
        })
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-50);

      const last = coordinates[coordinates.length - 1];

      tracks.push({
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
      });
    } catch (e) {
      console.error(`Failed to fetch OBIS for ${meta.scientific}:`, e);
    }
  });

  await Promise.all(promises);
  return tracks;
}
