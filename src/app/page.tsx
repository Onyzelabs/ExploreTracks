"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import type { SidebarContent } from "@/lib/types";
import { useCameras, useTracks } from "@/lib/hooks";
import CameraPanel from "@/components/Sidebar/CameraPanel";
import AnimalInfo from "@/components/Sidebar/AnimalInfo";

// Dynamic import — MapLibre requires browser globals (window, WebGL context)
const MapContainer = dynamic(() => import("@/components/Map/MapContainer"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[var(--color-surface-900)]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
        <p className="text-sm text-neutral-400">Initializing map…</p>
      </div>
    </div>
  ),
});

// ─── Loading skeleton for the navbar counters ─────────────────────────────────
function CountBadge({
  count,
  isLoading,
  error,
}: {
  count: number | undefined;
  isLoading: boolean;
  error: Error | undefined;
}) {
  if (isLoading)
    return (
      <span className="inline-block w-6 h-3 bg-neutral-700 rounded animate-pulse" />
    );
  if (error) return <span className="text-red-400 text-xs">err</span>;
  return <span>{count ?? 0}</span>;
}

// ─── Full-screen error banner ─────────────────────────────────────────────────
function DataErrorBanner({
  camerasError,
  tracksError,
}: {
  camerasError: Error | undefined;
  tracksError: Error | undefined;
}) {
  if (!camerasError && !tracksError) return null;
  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex flex-col gap-2 max-w-sm w-full px-4">
      {camerasError && (
        <div className="glass-card px-4 py-3 border-red-500/30 text-sm text-red-400 flex items-center gap-2">
          <span>⚠</span>
          <span>
            Camera data unavailable:{" "}
            <span className="font-mono text-xs">{camerasError.message}</span>
          </span>
        </div>
      )}
      {tracksError && (
        <div className="glass-card px-4 py-3 border-red-500/30 text-sm text-red-400 flex items-center gap-2">
          <span>⚠</span>
          <span>
            Track data unavailable:{" "}
            <span className="font-mono text-xs">{tracksError.message}</span>
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const [sidebarContent, setSidebarContent] = useState<SidebarContent>(null);

  // Live data from API routes (SWR-managed)
  const { cameras, isLoading: camerasLoading, error: camerasError } = useCameras();
  const { tracks, isLoading: tracksLoading, error: tracksError } = useTracks();

  const handleSelectContent = useCallback((content: SidebarContent) => {
    setSidebarContent(content);
  }, []);

  const handleClose = useCallback(() => {
    setSidebarContent(null);
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* ── Top Navigation Bar ─────────────────────────────────────────── */}
      <header className="flex-shrink-0 h-14 flex items-center px-5 gap-4 glass-card rounded-none border-x-0 border-t-0 z-20">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center shadow-lg">
            <span className="text-white text-sm" aria-hidden="true">🌍</span>
          </div>
          <span className="text-base font-bold tracking-tight text-neutral-100">
            Explore<span className="text-orange-500">Tracks</span>
          </span>
        </div>

        <div className="h-5 w-px bg-white/10" aria-hidden="true" />

        {/* Live counts */}
        <div className="flex items-center gap-4 text-xs text-neutral-400">
          <div className="flex items-center gap-1.5">
            <span aria-hidden="true">📷</span>
            <span>
              Live Cams (
              <CountBadge
                count={cameras?.length}
                isLoading={camerasLoading}
                error={camerasError}
              />
              )
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="w-4 h-0.5 bg-cyan-400 rounded inline-block"
              aria-hidden="true"
            />
            <span>
              Animal Tracks (
              <CountBadge
                count={tracks?.length}
                isLoading={tracksLoading}
                error={tracksError}
              />
              )
            </span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <a
            href="https://explore.org"
            target="_blank"
            rel="noopener noreferrer"
            id="nav-explore-link"
            className="text-xs px-3 py-1 rounded-full bg-orange-500/15 border border-orange-500/25 text-orange-400 hover:bg-orange-500/25 transition-colors font-medium"
          >
            explore.org
          </a>
          <a
            href="https://www.movebank.org"
            target="_blank"
            rel="noopener noreferrer"
            id="nav-movebank-link"
            className="text-xs px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/25 text-cyan-400 hover:bg-cyan-500/25 transition-colors font-medium"
          >
            Movebank
          </a>
        </div>
      </header>

      {/* ── Main Content ───────────────────────────────────────────────── */}
      <main className="flex flex-1 min-h-0 relative">
        {/* Map */}
        <div className="flex-1 min-w-0 relative">
          <MapContainer
            cameras={cameras ?? []}
            tracks={tracks ?? []}
            onSelectContent={handleSelectContent}
          />
          {/* Error banners float above the map */}
          <DataErrorBanner
            camerasError={camerasError}
            tracksError={tracksError}
          />
        </div>

        {/* Right Sidebar */}
        {sidebarContent !== null && (
          <aside
            id="explore-sidebar"
            className="flex-shrink-0 w-[360px] h-full overflow-hidden z-10"
          >
            {sidebarContent.type === "camera" && (
              <CameraPanel
                camera={sidebarContent.camera}
                onClose={handleClose}
              />
            )}
            {sidebarContent.type === "animal" && (
              <AnimalInfo
                track={sidebarContent.track}
                onClose={handleClose}
              />
            )}
          </aside>
        )}
      </main>

      {/* ── Bottom Status Bar ──────────────────────────────────────────── */}
      <footer className="flex-shrink-0 h-7 flex items-center justify-between px-5 border-t border-[var(--glass-border)] bg-[var(--color-surface-900)]">
        <span className="text-[10px] text-neutral-600">
          Map © OpenStreetMap contributors · Stadia Maps
        </span>
        <span className="text-[10px] text-neutral-600">
          Animal data © Movebank · Wildlife cams © explore.org
        </span>
      </footer>
    </div>
  );
}
