"use client";

import { useState, useMemo } from "react";
import { Heart, X, Radio, ExternalLink } from "lucide-react";
import type { ExploreCamera } from "@/lib/types";
import { CATEGORY_META } from "@/lib/types";

interface CameraListPanelProps {
  cameras: ExploreCamera[];
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
  onOpen: (cam: ExploreCamera) => void;
  onClose: () => void;
  openVideoIds: Set<string>;
}

/** Simulated hourly activity (0-1) for a camera, deterministic by id hash */
function getHourlyActivity(camId: string): number[] {
  const hash = camId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return Array.from({ length: 24 }, (_, h) => {
    // Base curve: peak at 7am and 7pm
    const morning = Math.exp(-((h - 7) ** 2) / 8);
    const evening = Math.exp(-((h - 19) ** 2) / 8);
    const base = (morning + evening * 0.8) * 0.7;
    // Add camera-specific noise
    const noise = ((hash * (h + 1) * 2654435761) % 1000) / 1000 * 0.3;
    return Math.min(1, base + noise);
  });
}

export default function CameraListPanel({
  cameras,
  favorites,
  onToggleFavorite,
  onOpen,
  onClose,
  openVideoIds,
}: CameraListPanelProps) {
  const [search, setSearch] = useState("");
  const [showFavOnly, setShowFavOnly] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return cameras.filter((c) => {
      if (showFavOnly && !favorites.has(c.id)) return false;
      if (q && !c.name.toLowerCase().includes(q) && !c.location.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [cameras, search, showFavOnly, favorites]);

  return (
    <>
      {/* Backdrop for mobile */}
      <div
        className="fixed inset-0 z-[99] bg-black/60 sm:hidden"
        onClick={onClose}
        aria-hidden
      />

      <div
        id="camera-list-panel"
        className="fixed right-0 top-0 h-full z-[100] w-full sm:w-[420px] flex flex-col bg-[var(--color-surface-900)] border-l border-[var(--glass-border)] shadow-2xl anim-slide-right"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--glass-border)] flex-shrink-0">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-neutral-100" style={{ fontFamily: "var(--font-sans)" }}>
                Live Cameras
              </h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 font-semibold">
                {cameras.length}
              </span>
            </div>
          </div>
          <button
            onClick={() => setShowFavOnly((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              showFavOnly
                ? "bg-orange-500/20 text-orange-400 border-orange-500/40"
                : "bg-white/5 text-neutral-400 border-white/10"
            }`}
            title="Show favorites only"
          >
            <Heart size={12} className={showFavOnly ? "fill-orange-400" : ""} />
            Favorites
          </button>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close camera list"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-2 border-b border-[var(--glass-border)] flex-shrink-0">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search cameras..."
            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500/50 transition-colors"
            style={{ fontFamily: "var(--font-sans)" }}
          />
        </div>

        {/* Camera grid */}
        <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-3 content-start" style={{ WebkitOverflowScrolling: "touch" }}>
          {filtered.length === 0 && (
            <div className="col-span-2 text-center text-neutral-500 text-sm py-8">
              {showFavOnly ? "No favorites yet. Click ♡ on any camera." : "No cameras found."}
            </div>
          )}
          {filtered.map((cam) => {
            const meta = CATEGORY_META[cam.category];
            const isFav = favorites.has(cam.id);
            const isOpen = openVideoIds.has(cam.id);
            const activity = getHourlyActivity(cam.id);

            return (
              <div
                key={cam.id}
                className="flex flex-col rounded-xl border border-[var(--glass-border)] bg-[var(--color-surface-800)] overflow-hidden hover:border-white/15 transition-colors"
              >
                {/* Thumbnail */}
                <div className="relative aspect-video bg-black flex-shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cam.thumbnail}
                    alt={cam.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${cam.youtubeVideoId}/hqdefault.jpg`;
                    }}
                  />
                  {/* Live badge */}
                  {cam.isLive && (
                    <div className="absolute top-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/70 border border-red-500/40">
                      <Radio size={8} className="text-red-400 animate-pulse" />
                      <span className="text-[10px] font-bold text-red-400">LIVE</span>
                    </div>
                  )}
                  {/* Category emoji */}
                  <div className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ background: meta.color + "33", border: `1px solid ${meta.color}66`, color: meta.color }}>
                    <meta.icon size={14} />
                  </div>
                  {/* Favorite button */}
                  <button
                    onClick={() => onToggleFavorite(cam.id)}
                    className="absolute bottom-1.5 right-1.5 w-7 h-7 flex items-center justify-center rounded-full bg-black/60 transition-transform hover:scale-110"
                    aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
                  >
                    <Heart
                      size={14}
                      className={isFav ? "text-orange-400 fill-orange-400" : "text-neutral-300"}
                    />
                  </button>
                </div>

                {/* Info */}
                <div className="p-2 flex flex-col gap-1.5 flex-1">
                  <p className="text-xs font-semibold text-neutral-100 leading-tight line-clamp-2" style={{ fontFamily: "var(--font-sans)" }}>
                    {cam.name}
                  </p>
                  <p className="text-[10px] text-neutral-500 truncate">{cam.location}</p>

                  {/* Peak hours heatmap */}
                  <div className="mt-1">
                    <p className="text-[9px] text-neutral-600 mb-1 uppercase tracking-wider">Peak Activity</p>
                    <div className="flex items-end gap-px h-4">
                      {activity.map((v, h) => (
                        <div
                          key={h}
                          className="flex-1 rounded-sm"
                          style={{
                            height: `${Math.max(15, v * 100)}%`,
                            background: `rgba(249, 115, 22, ${0.2 + v * 0.7})`,
                          }}
                          title={`${h}:00 — ${Math.round(v * 100)}%`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Open button */}
                  <button
                    onClick={() => onOpen(cam)}
                    disabled={isOpen}
                    className="mt-1 w-full py-1.5 rounded-lg text-xs font-semibold transition-colors"
                    style={{
                      background: isOpen ? "rgba(255,255,255,0.05)" : `${meta.color}22`,
                      color: isOpen ? "#52525b" : meta.color,
                      border: `1px solid ${isOpen ? "transparent" : meta.color + "44"}`,
                      cursor: isOpen ? "not-allowed" : "pointer",
                    }}
                  >
                    {isOpen ? "Already Open" : "Open Stream"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
