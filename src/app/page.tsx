"use client";

import { useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import type { SidebarContent, FilterState, ExploreCamera, OpenVideoPanel, AnimalTrack } from "@/lib/types";
import { DEFAULT_FILTER } from "@/lib/types";
import { useCameras, useTracks } from "@/lib/hooks";
import { useFavorites } from "@/lib/useFavorites";
import { useCameraNotifications } from "@/lib/useNotifications";
import AnimalInfo from "@/components/Sidebar/AnimalInfo";
import TrackComparePanel from "@/components/Sidebar/TrackComparePanel";
import FilterPanel from "@/components/Filter/FilterPanel";
import CameraListPanel from "@/components/Camera/CameraListPanel";

const MapContainer = dynamic(() => import("@/components/Map/MapContainer"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[var(--color-surface-950)]">
      <div className="w-10 h-10 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
    </div>
  ),
});

const FloatingVideoDock = dynamic(
  () => import("@/components/VideoManager/FloatingVideoDock"),
  { ssr: false },
);

const GlobalChat = dynamic(() => import("@/components/Chat/GlobalChat"), {
  ssr: false,
});

const MAX_OPEN_VIDEOS = 12;

// ─── Loading skeleton badge ───────────────────────────────────────────────────
function CountBadge({
  count,
  isLoading,
  error,
}: {
  count?: number;
  isLoading: boolean;
  error?: Error;
}) {
  if (isLoading)
    return (
      <span className="inline-block w-5 h-2.5 bg-neutral-700 rounded animate-pulse align-middle" />
    );
  if (error) return <span className="text-red-400">!</span>;
  return <>{count ?? 0}</>;
}

// ─── Error banner ─────────────────────────────────────────────────────────────
function ErrorBanner({ label, error }: { label: string; error: Error }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/25 text-red-400 text-xs">
      <span>⚠</span>
      <span>
        <b>{label}:</b> {error.message}
      </span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const [sidebarContent, setSidebarContent] = useState<SidebarContent>(null);
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);
  const [openVideos, setOpenVideos] = useState<OpenVideoPanel[]>([]);
  const [mapStyle, setMapStyle] = useState<string>(
    "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  );
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState<number | null>(null);
  // Compare mode: set of track IDs shown simultaneously on the map
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  // Weather overlay layer
  const [weatherLayer, setWeatherLayer] = useState<"clouds_new" | "precipitation_new" | "wind_new" | null>(null);
  // Camera list panel visibility
  const [showCameraList, setShowCameraList] = useState(false);

  const { favorites, toggle: toggleFavorite, isFavorite } = useFavorites();
  const { subscribe, unsubscribe, isSubscribed } = useCameraNotifications();

  const { cameras, isLoading: camLoading, error: camError } = useCameras();
  const { tracks, isLoading: trackLoading, error: trackError } = useTracks();

  const openVideoIds = useMemo(
    () => new Set(openVideos.map((p) => p.camera.id)),
    [openVideos],
  );

  const handleOpenCamera = useCallback((camera: ExploreCamera) => {
    setOpenVideos((prev) => {
      if (prev.find((p) => p.camera.id === camera.id)) return prev; // Already open

      const usedSlots = new Set(prev.map((p) => p.slot));
      let freeSlot = 0;

      let next = [...prev];
      if (next.length >= MAX_OPEN_VIDEOS) {
        // Replace oldest
        const oldest = next.shift();
        if (oldest) freeSlot = oldest.slot; // reuse slot of the closed video
      } else {
        while (usedSlots.has(freeSlot)) freeSlot++;
      }

      return [...next, { camera, slot: freeSlot }];
    });
  }, []);

  const handleCloseVideo = useCallback((id: string) => {
    setOpenVideos((prev) => prev.filter((p) => p.camera.id !== id));
  }, []);

  const handleSelectAnimal = useCallback((content: SidebarContent) => {
    setSidebarContent(content);
    setPlaybackIndex(null); // Reset playback when switching animals
  }, []);

  const handleCloseSidebar = useCallback(() => {
    setSidebarContent(null);
    setPlaybackIndex(null);
  }, []);

  const handlePlaybackIndex = useCallback((index: number | null) => {
    setPlaybackIndex(index);
  }, []);

  // Add a track to compare mode (switches sidebar to compare panel)
  const handleCompare = useCallback((track: AnimalTrack) => {
    setCompareIds((prev) => {
      const next = new Set(prev);
      next.add(track.id);
      return next;
    });
    setSidebarContent({ type: "compare", trackIds: new Set() });
    setPlaybackIndex(null);
  }, []);

  const handleToggleCompareTrack = useCallback((id: string) => {
    setCompareIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      if (next.size === 0) setSidebarContent(null);
      return next;
    });
  }, []);

  const handleCloseCompare = useCallback(() => {
    setSidebarContent(null);
    setCompareIds(new Set());
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* ── Top Nav ─────────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 flex flex-col border-b border-[var(--glass-border)] bg-[var(--color-surface-900)] z-20">
        {/* Primary row */}
        <div className="flex items-center px-4 gap-3 h-[52px]">
          {/* Logo */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
              <rect width="28" height="28" rx="8" fill="url(#logo-grad)" />
              <path d="M7 19 Q11 9 17 13 Q21 16 22 10" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.9" />
              <circle cx="22" cy="10" r="2.5" fill="#fff" opacity="0.95" />
              <circle cx="7" cy="19" r="2" fill="#fff" opacity="0.6" />
              <defs>
                <linearGradient id="logo-grad" x1="0" y1="0" x2="28" y2="28">
                  <stop offset="0%" stopColor="#f97316" />
                  <stop offset="100%" stopColor="#f59e0b" />
                </linearGradient>
              </defs>
            </svg>
            <span className="text-xl font-bold tracking-tight text-neutral-100" style={{ fontFamily: "var(--font-sans)" }}>
              Explore<span style={{ color: "var(--color-brand-primary)" }}>Tracks</span>
            </span>
          </div>

          <div className="w-px h-5 bg-white/10 flex-shrink-0" />

          {/* Filter — always visible */}
          <FilterPanel filter={filter} onChange={setFilter} />

          {/* Stats — hidden on mobile */}
          <div className="hidden sm:flex items-center gap-3 text-sm font-medium text-neutral-300" style={{ fontFamily: "var(--font-sans)" }}>
            <div className="w-px h-5 bg-white/10" />
            <div className="flex items-center gap-1.5 bg-[var(--color-surface-800)] px-3 py-1.5 rounded-md border border-[var(--glass-border)]">
              <span className="text-base">📷</span>
              <span><CountBadge count={cameras?.length} isLoading={camLoading} error={camError} /> cams</span>
            </div>
            <div className="flex items-center gap-1.5 bg-[var(--color-surface-800)] px-3 py-1.5 rounded-md border border-[var(--glass-border)]">
              <span className="text-base">🐾</span>
              <span><CountBadge count={tracks?.length} isLoading={trackLoading} error={trackError} /> tracks</span>
            </div>
            {openVideos.length > 0 && (
              <div className="flex items-center gap-2 bg-orange-500/10 px-3 py-1.5 rounded-md border border-orange-500/20">
                <span className="text-orange-400 text-sm">▶ {openVideos.length}/{MAX_OPEN_VIDEOS} open</span>
                <button
                  onClick={() => setOpenVideos([])}
                  className="ml-1 text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-300 hover:bg-red-500/40 hover:text-white transition-colors"
                >
                  Close All
                </button>
              </div>
            )}
          </div>

          {/* Right-side controls */}
          <div className="ml-auto flex items-center gap-2">
            {/* Errors */}
            {(camError || trackError) && (
              <div className="hidden sm:flex gap-2">
                {camError && <ErrorBanner label="Cameras" error={camError} />}
                {trackError && <ErrorBanner label="Tracks" error={trackError} />}
              </div>
            )}

            {/* Map style — hidden on mobile (moved to menu) */}
            <select
              value={mapStyle}
              onChange={(e) => setMapStyle(e.target.value)}
              className="hidden sm:block text-sm px-3 py-1.5 rounded-md bg-[var(--color-surface-800)] border border-[var(--glass-border)] text-neutral-300 focus:outline-none focus:border-orange-500"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              <option value="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json">Dark Map</option>
              <option value="https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json">Voyager</option>
              <option value="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json">Light Map</option>
              <option value="satellite">Satellite</option>
            </select>

            {/* Weather overlay toggle — hidden on mobile */}
            <select
              value={weatherLayer ?? ""}
              onChange={(e) => setWeatherLayer((e.target.value || null) as typeof weatherLayer)}
              className="hidden sm:block text-sm px-3 py-1.5 rounded-md bg-[var(--color-surface-800)] border border-[var(--glass-border)] text-neutral-300 focus:outline-none focus:border-blue-500"
              style={{ fontFamily: "var(--font-sans)" }}
              title="Weather overlay (requires NEXT_PUBLIC_OWM_KEY)"
            >
              <option value="">No Weather</option>
              <option value="clouds_new">☁ Clouds</option>
              <option value="precipitation_new">🌧 Rain</option>
              <option value="wind_new">💨 Wind</option>
            </select>

            {/* Camera list panel toggle */}
            <button
              id="toggle-camera-list"
              onClick={() => setShowCameraList((v) => !v)}
              className={`hidden sm:flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border transition-colors ${
                showCameraList
                  ? "bg-orange-500/20 border-orange-500/40 text-orange-400"
                  : "bg-[var(--color-surface-800)] border-[var(--glass-border)] text-neutral-300 hover:text-white"
              }`}
              style={{ fontFamily: "var(--font-sans)" }}
              title="Browse all cameras"
            >
              📋 Cameras
            </button>


            {/* External links — hidden on mobile */}
            <a href="https://explore.org" target="_blank" rel="noopener noreferrer" id="nav-explore-link"
              className="hidden sm:inline-flex text-sm px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 hover:bg-orange-500/20 transition-colors font-medium"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              explore.org
            </a>
            <a href="https://www.movebank.org" target="_blank" rel="noopener noreferrer" id="nav-movebank-link"
              className="hidden sm:inline-flex text-sm px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 transition-colors font-medium"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              Movebank
            </a>

            {/* Mobile hamburger */}
            <button
              className="sm:hidden w-9 h-9 flex items-center justify-center rounded-lg bg-[var(--color-surface-800)] border border-[var(--glass-border)] text-neutral-300"
              onClick={() => setShowMobileMenu((v) => !v)}
              aria-label="Menu"
            >
              {showMobileMenu ? "✕" : "☰"}
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {showMobileMenu && (
          <div className="sm:hidden flex flex-col gap-3 px-4 py-3 border-t border-[var(--glass-border)] bg-[var(--color-surface-950)]">
            <select
              value={mapStyle}
              onChange={(e) => { setMapStyle(e.target.value); setShowMobileMenu(false); }}
              className="w-full text-sm px-3 py-2 rounded-md bg-[var(--color-surface-800)] border border-[var(--glass-border)] text-neutral-300 focus:outline-none"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              <option value="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json">Dark Map</option>
              <option value="https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json">Voyager</option>
              <option value="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json">Light Map</option>
              <option value="satellite">Satellite</option>
            </select>
            {openVideos.length > 0 && (
              <button
                onClick={() => { setOpenVideos([]); setShowMobileMenu(false); }}
                className="w-full text-sm py-2 rounded-md bg-red-500/20 text-red-300 border border-red-500/20"
              >
                Close All Videos ({openVideos.length})
              </button>
            )}
            <div className="flex gap-2">
              <a href="https://explore.org" target="_blank" rel="noopener noreferrer"
                className="flex-1 text-center text-sm py-2 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400"
              >explore.org</a>
              <a href="https://www.movebank.org" target="_blank" rel="noopener noreferrer"
                className="flex-1 text-center text-sm py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400"
              >Movebank</a>
            </div>
          </div>
        )}
      </header>

      {/* ── Global Real-time Chat ──────────────────────────────────────── */}
      <GlobalChat />

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main className="flex flex-1 min-h-0 relative">
        {/* Full-screen map */}
        <div className="flex-1 min-w-0 relative">
          <MapContainer
            key={mapStyle}
            cameras={cameras ?? []}
            tracks={tracks ?? []}
            filter={filter}
            openVideoIds={openVideoIds}
            activeTrackId={
              sidebarContent?.type === "animal" ? sidebarContent.track.id : null
            }
            compareTrackIds={compareIds}
            playbackIndex={playbackIndex}
            weatherLayer={weatherLayer}
            mapStyle={mapStyle}
            onOpenCamera={handleOpenCamera}
            onSelectAnimal={handleSelectAnimal}
          />

          {/* Floating multi-video dock */}
          <FloatingVideoDock
            openPanels={openVideos}
            onClose={handleCloseVideo}
          />

          {/* Click-to-open hint (only when no videos open yet) */}
          {!camLoading &&
            (cameras?.length ?? 0) > 0 &&
            openVideos.length === 0 && (
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 pointer-events-none anim-fade-in">
                <div className="glass-card-sm px-4 py-2 text-xs text-neutral-400 flex items-center gap-2">
                  <span>📷</span>
                  <span style={{ fontFamily: "var(--font-sans)" }}>
                    Click a camera icon on the map to open a live stream
                  </span>
                </div>
              </div>
            )}
        </div>

        {/* Right sidebar — animal info OR compare panel */}
        {sidebarContent?.type === "animal" && (
          <aside
            id="animal-sidebar"
            className="absolute sm:relative right-0 flex-shrink-0 w-full sm:w-[340px] h-full z-30 sm:z-10 anim-slide-right overflow-hidden shadow-2xl sm:shadow-none bg-[var(--color-surface-900)]"
          >
            <AnimalInfo
              track={sidebarContent.track}
              onClose={handleCloseSidebar}
              onPlaybackIndex={handlePlaybackIndex}
              onCompare={handleCompare}
            />
          </aside>
        )}
        {sidebarContent?.type === "compare" && (
          <aside
            id="compare-sidebar"
            className="absolute sm:relative right-0 flex-shrink-0 w-full sm:w-[360px] h-full z-30 sm:z-10 anim-slide-right overflow-hidden shadow-2xl sm:shadow-none bg-[var(--color-surface-900)]"
          >
            <TrackComparePanel
              tracks={tracks ?? []}
              compareIds={compareIds}
              onToggleTrack={handleToggleCompareTrack}
              onClose={handleCloseCompare}
            />
          </aside>
        )}
      </main>

      {/* Camera list panel */}
      {showCameraList && (
        <CameraListPanel
          cameras={cameras ?? []}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          onOpen={(cam) => { handleOpenCamera(cam); }}
          onClose={() => setShowCameraList(false)}
          openVideoIds={openVideoIds}
        />
      )}

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="absolute bottom-1 right-1 z-10 pointer-events-none flex flex-col items-end opacity-50">
        <span
          className="text-xs text-neutral-500 font-medium drop-shadow-md"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          Map © OpenStreetMap & CartoDB | Telemetry © Movebank | Live Streams © Explore.org
        </span>
      </footer>
    </div>
  );
}
