import { z } from "zod";

// ─── explore.org Camera ──────────────────────────────────────────────────────

export const CameraCategorySchema = z.enum([
  "birds",
  "mammals",
  "marine",
  "bears",
  "african",
  "general",
]);

export const ExploreCameraSchema = z.object({
  id: z.string(),
  name: z.string(),
  location: z.string(),
  country: z.string(),
  coordinates: z.tuple([z.number(), z.number()]), // [longitude, latitude]
  youtubeVideoId: z.string(),
  embedUrl: z.string().url(),
  thumbnail: z.string().url(),
  isLive: z.boolean(),
  category: CameraCategorySchema,
  description: z.string(),
});

export type ExploreCamera = z.infer<typeof ExploreCameraSchema>;

// ─── Movebank Animal Track ───────────────────────────────────────────────────

export const TrackPointSchema = z.object({
  longitude: z.number(),
  latitude: z.number(),
  timestamp: z.number(), // Unix epoch ms
  speed: z.number().optional(),
  altitude: z.number().optional(),
});

export const AnimalTrackSchema = z.object({
  id: z.string(),
  individualName: z.string(),
  species: z.string(),
  commonName: z.string(),
  studyId: z.number(),
  studyName: z.string(),
  color: z.string(),
  coordinates: z.array(TrackPointSchema),
  currentPosition: z.tuple([z.number(), z.number()]).optional(),
  tags: z.array(z.string()),
});

export type AnimalTrack = z.infer<typeof AnimalTrackSchema>;
export type TrackPoint = z.infer<typeof TrackPointSchema>;

// ─── YouTube Live Chat ───────────────────────────────────────────────────────

export const LiveChatMessageSchema = z.object({
  id: z.string(),
  authorName: z.string(),
  message: z.string(),
  timestamp: z.number(),
  authorPhotoUrl: z.string().url().optional(),
});

export type LiveChatMessage = z.infer<typeof LiveChatMessageSchema>;

// ─── API Response envelopes ──────────────────────────────────────────────────

export const ApiSuccessSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    cachedAt: z.string().datetime().optional(),
  });

export const ApiErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.string().optional(),
});

// ─── UI State ────────────────────────────────────────────────────────────────

export type SidebarContent =
  | { type: "camera"; camera: ExploreCamera }
  | { type: "animal"; track: AnimalTrack }
  | null;

export interface MapViewState {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
}
