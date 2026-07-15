"use client";

import { useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import type { SidebarContent, FilterState, ExploreCamera } from "@/lib/types";
import { DEFAULT_FILTER, CATEGORY_META, ANIMAL_TYPE_META } from "@/lib/types";
import { useCameras, useTracks } from "@/lib/hooks";
import AnimalInfo from "@/components/Sidebar/AnimalInfo";
import FilterPanel from "@/components/Filter/FilterPanel";

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
  { ssr: false }
);

const MAX_OPEN_VIDEOS = 4;

// ─── Loading skeleton badge ───────────────────────────────────────────────────
function CountBadge({ count, isLoading, error }: { count?: number; isLoading: boolean; error?: Error }) {
  if (isLoading) return <span className="inline-block w-5 h-2.5 bg-neutral-700 rounded animate-pulse align-middle" />;
  if (error)     return <span className="text-red-400">!</span>;
  return <>{count ?? 0}</>;
}

// ─── Error banner ─────────────────────────────────────────────────────────────
function ErrorBanner({ label, error }: { label: string; error: Error }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/25 text-red-400 text-xs">
      <span>⚠</span>
      <span><b>{label}:</b> {error.message}</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const [sidebarContent, setSidebarContent] = useState<SidebarContent>(null);
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);
  const [openVideos, setOpenVideos] = useState<ExploreCamera[]>([]);

  const { cameras, isLoading: camLoading, error: camError } = useCameras();
  const { tracks, isLoading: trackLoading, error: trackError } = useTracks();

  const openVideoIds = useMemo(
    () => new Set(openVideos.map((c) => c.id)),
    [openVideos]
  );

  const handleOpenCamera = useCallback((camera: ExploreCamera) => {
    setOpenVideos((prev) => {
      if (prev.find((c) => c.id === camera.id)) return prev; // Already open
      if (prev.length >= MAX_OPEN_VIDEOS) {
        // Replace oldest
        return [...prev.slice(1), camera];
      }
      return [...prev, camera];
    });
  }, []);

  const handleCloseVideo = useCallback((id: string) => {
    setOpenVideos((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const handleSelectAnimal = useCallback((content: SidebarContent) => {
    setSidebarContent(content);
  }, []);

  const handleCloseSidebar = useCallback(() => setSidebarContent(null), []);

  return (
    <div className="flex flex-col h-full">
      {/* ── Top Nav ─────────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 h-13 flex items-center px-4 gap-3 border-b border-[var(--glass-border)] bg-[var(--color-surface-900)] z-20">
        {/* Logo */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          {/* Inline SVG logo mark */}
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
            <rect width="28" height="28" rx="8" fill="url(#logo-grad)" />
            <path d="M7 19 Q11 9 17 13 Q21 16 22 10" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.9"/>
            <circle cx="22" cy="10" r="2.5" fill="#fff" opacity="0.95"/>
            <circle cx="7" cy="19" r="2" fill="#fff" opacity="0.6"/>
            <defs>
              <linearGradient id="logo-grad" x1="0" y1="0" x2="28" y2="28">
                <stop offset="0%" stopColor="#f97316"/>
                <stop offset="100%" stopColor="#f59e0b"/>
              </linearGradient>
            </defs>
          </svg>
          <span
            className="text-base font-bold tracking-tight text-neutral-100"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Explore<span style={{ color: "var(--color-brand-primary)" }}>Tracks</span>
          </span>
        </div>

        <div className="w-px h-5 bg-white/10 flex-shrink-0" />

        {/* Filter panel */}
        <FilterPanel filter={filter} onChange={setFilter} />

        <div className="w-px h-5 bg-white/10 flex-shrink-0" />

        {/* Live counts */}
        <div className="flex items-center gap-3 text-xs text-neutral-500" style={{ fontFamily: "var(--font-sans)" }}>
          <span>
            📷 <CountBadge count={cameras?.length} isLoading={camLoading} error={camError} /> cams
          </span>
          <span>
            🐾 <CountBadge count={tracks?.length} isLoading={trackLoading} error={trackError} /> tracks
          </span>
          {openVideos.length > 0 && (
            <span className="text-orange-400">
              ▶ {openVideos.length}/{MAX_OPEN_VIDEOS} open
            </span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {(camError || trackError) && (
            <div className="flex gap-2">
              {camError  && <ErrorBanner label="Cameras" error={camError} />}
              {trackError && <ErrorBanner label="Tracks"  error={trackError} />}
            </div>
          )}
          <a
            href="https://explore.org" target="_blank" rel="noopener noreferrer"
            id="nav-explore-link"
            className="text-[11px] px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 hover:bg-orange-500/20 transition-colors"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            explore.org
          </a>
          <a
            href="https://www.movebank.org" target="_blank" rel="noopener noreferrer"
            id="nav-movebank-link"
            className="text-[11px] px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 transition-colors"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Movebank
          </a>
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main className="flex flex-1 min-h-0 relative">
        {/* Full-screen map */}
        <div className="flex-1 min-w-0 relative">
          <MapContainer
            cameras={cameras ?? []}
            tracks={tracks ?? []}
            filter={filter}
            openVideoIds={openVideoIds}
            activeTrackId={sidebarContent?.type === "animal" ? sidebarContent.track.id : null}
            onOpenCamera={handleOpenCamera}
            onSelectAnimal={handleSelectAnimal}
          />

          {/* Floating multi-video dock */}
          <FloatingVideoDock
            openPanels={openVideos}
            onClose={handleCloseVideo}
          />

          {/* Click-to-open hint (only when no videos open yet) */}
          {!camLoading && (cameras?.length ?? 0) > 0 && openVideos.length === 0 && (
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

        {/* Right sidebar — animal info only */}
        {sidebarContent?.type === "animal" && (
          <aside id="animal-sidebar" className="flex-shrink-0 w-[340px] h-full z-10 anim-slide-right overflow-hidden">
            <AnimalInfo track={sidebarContent.track} onClose={handleCloseSidebar} />
          </aside>
        )}
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="flex-shrink-0 h-6 flex items-center justify-between px-4 border-t border-[var(--glass-border)] bg-[var(--color-surface-950)]">
        <span className="text-[10px] text-neutral-700" style={{ fontFamily: "var(--font-sans)" }}>
          Map © OpenStreetMap · Stadia Maps
        </span>
        <span className="text-[10px] text-neutral-700" style={{ fontFamily: "var(--font-sans)" }}>
          Animal data © Movebank · Cams © explore.org
        </span>
      </footer>
    </div>
  );
}
