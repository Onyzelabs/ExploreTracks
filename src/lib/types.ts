import { z } from "zod";

// ─── Category / Type Definitions ─────────────────────────────────────────────

export const CameraCategorySchema = z.enum([
  "birds",
  "mammals",
  "marine",
  "bears",
  "african",
  "general",
]);
export type CameraCategory = z.infer<typeof CameraCategorySchema>;

export const AnimalTypeSchema = z.enum([
  "bird",
  "mammal",
  "marine_mammal",
  "bear",
  "reptile",
  "fish",
  "insect",
  "unknown",
]);
export type AnimalType = z.infer<typeof AnimalTypeSchema>;

// ─── Map marker config (single source of truth for icons + colors) ────────────

export const CATEGORY_META: Record<
  CameraCategory,
  { emoji: string; color: string; label: string }
> = {
  birds: { emoji: "🦅", color: "#a3e635", label: "Birds" },
  mammals: { emoji: "🐾", color: "#f97316", label: "Mammals" },
  marine: { emoji: "🐬", color: "#06b6d4", label: "Marine" },
  bears: { emoji: "🐻", color: "#f59e0b", label: "Bears" },
  african: { emoji: "🦁", color: "#fb923c", label: "African Wildlife" },
  general: { emoji: "📷", color: "#a78bfa", label: "General" },
};

export const ANIMAL_TYPE_META: Record<
  AnimalType,
  { emoji: string; color: string; label: string }
> = {
  bird: { emoji: "🦅", color: "#a3e635", label: "Birds" },
  mammal: { emoji: "🐾", color: "#f97316", label: "Mammals" },
  marine_mammal: { emoji: "🐬", color: "#06b6d4", label: "Marine Mammals" },
  bear: { emoji: "🐻", color: "#f59e0b", label: "Bears" },
  reptile: { emoji: "🦎", color: "#4ade80", label: "Reptiles" },
  fish: { emoji: "🐟", color: "#38bdf8", label: "Fish" },
  insect: { emoji: "🦋", color: "#e879f9", label: "Insects" },
  unknown: { emoji: "❔", color: "#9ca3af", label: "Unknown" },
};

// ─── Explore.org Camera ───────────────────────────────────────────────────────

export const ExploreCameraSchema = z.object({
  id: z.string(),
  name: z.string(),
  location: z.string(),
  country: z.string(),
  coordinates: z.tuple([z.number(), z.number()]), // [lng, lat]
  youtubeVideoId: z.string(),
  embedUrl: z.string().url(),
  thumbnail: z.string().url(),
  isLive: z.boolean(),
  category: CameraCategorySchema,
  description: z.string(),
});
export type ExploreCamera = z.infer<typeof ExploreCameraSchema>;

// ─── Movebank Animal Track ────────────────────────────────────────────────────

export const TrackPointSchema = z.object({
  longitude: z.number(),
  latitude: z.number(),
  timestamp: z.number(),
  speed: z.number().optional(),
  altitude: z.number().optional(),
});
export type TrackPoint = z.infer<typeof TrackPointSchema>;

export const AnimalTrackSchema = z.object({
  id: z.string(),
  individualName: z.string(),
  species: z.string(),
  commonName: z.string(),
  studyId: z.number(),
  studyName: z.string(),
  color: z.string(),
  animalType: AnimalTypeSchema,
  coordinates: z.array(TrackPointSchema),
  currentPosition: z.tuple([z.number(), z.number()]).optional(),
  tags: z.array(z.string()),
});
export type AnimalTrack = z.infer<typeof AnimalTrackSchema>;

// ─── YouTube Live Chat ────────────────────────────────────────────────────────

export const LiveChatMessageSchema = z.object({
  id: z.string(),
  authorName: z.string(),
  message: z.string(),
  timestamp: z.number(),
  authorPhotoUrl: z.string().url().optional(),
});
export type LiveChatMessage = z.infer<typeof LiveChatMessageSchema>;

// ─── Filter State ─────────────────────────────────────────────────────────────

export interface FilterState {
  cameraCategories: Set<CameraCategory>;
  animalTypes: Set<AnimalType>;
  searchText: string;
}

export const DEFAULT_FILTER: FilterState = {
  cameraCategories: new Set(Object.keys(CATEGORY_META) as CameraCategory[]),
  animalTypes: new Set(Object.keys(ANIMAL_TYPE_META) as AnimalType[]),
  searchText: "",
};

// ─── Multi-Video Panel State ──────────────────────────────────────────────────

export interface OpenVideoPanel {
  camera: ExploreCamera;
  /** Position slot 0-3 (quad layout) */
  slot: number;
}

// ─── Sidebar (animal info panel or multi-track comparison) ──────────────────
export type SidebarContent =
  | { type: "animal"; track: AnimalTrack }
  | { type: "compare"; trackIds: Set<string> }
  | null;
