"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, Search, ArrowLeft, Radio, Map } from "lucide-react";
import { useCameras } from "@/lib/hooks";
import { useFavorites } from "@/lib/useFavorites";
import { CATEGORY_META } from "@/lib/types";

export default function CamerasPage() {
  const router = useRouter();
  const { cameras, isLoading, error } = useCameras();
  const { favorites, toggle: onToggleFavorite } = useFavorites();
  
  const [search, setSearch] = useState("");
  const [showFavOnly, setShowFavOnly] = useState(false);

  const filtered = useMemo(() => {
    if (!cameras) return [];
    const q = search.toLowerCase();
    return cameras.filter((c) => {
      if (showFavOnly && !favorites.has(c.id)) return false;
      if (q && !c.name.toLowerCase().includes(q) && !c.location.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [cameras, search, showFavOnly, favorites]);

  return (
    <div className="h-full overflow-y-auto bg-[var(--color-surface-950)] text-neutral-200" style={{ WebkitOverflowScrolling: "touch" }}>
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[var(--color-surface-950)]/80 backdrop-blur-md border-b border-[var(--glass-border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="w-10 h-10 flex items-center justify-center rounded-full bg-[var(--color-surface-800)] hover:bg-[var(--color-surface-700)] transition-colors border border-[var(--glass-border)]"
              title="Back to Map"
            >
              <ArrowLeft size={20} className="text-neutral-300" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight" style={{ fontFamily: "var(--font-sans)" }}>
                Live Cameras
              </h1>
              <p className="text-sm text-neutral-400">
                {isLoading ? "Loading..." : `${cameras?.length || 0} cameras worldwide`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search cameras..."
                className="w-full sm:w-64 bg-black/40 border border-white/10 rounded-full pl-10 pr-4 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500/50 transition-all"
                style={{ fontFamily: "var(--font-sans)" }}
              />
            </div>
            {/* Favorites Toggle */}
            <button
              onClick={() => setShowFavOnly((v) => !v)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
                showFavOnly
                  ? "bg-orange-500/20 text-orange-400 border-orange-500/40"
                  : "bg-[var(--color-surface-800)] text-neutral-400 border-white/10 hover:text-white"
              }`}
            >
              <Heart size={16} className={showFavOnly ? "fill-orange-400" : ""} />
              <span className="hidden sm:inline">Favorites</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 mb-8">
            Failed to load cameras: {error.message}
          </div>
        )}

        {filtered.length === 0 && !isLoading && !error && (
          <div className="text-center py-20 text-neutral-500 text-lg">
            {showFavOnly ? "No favorites yet. Click the heart icon on a camera to save it." : "No cameras found matching your search."}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {filtered.map((cam) => {
            const meta = CATEGORY_META[cam.category];
            const isFav = favorites.has(cam.id);

            return (
              <div
                key={cam.id}
                className="flex flex-col rounded-2xl border border-[var(--glass-border)] bg-[var(--color-surface-800)] overflow-hidden hover:border-white/20 transition-all group hover:shadow-xl hover:shadow-black/50"
              >
                {/* Thumbnail */}
                <div className="relative aspect-video bg-black flex-shrink-0 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cam.thumbnail}
                    alt={cam.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${cam.youtubeVideoId}/hqdefault.jpg`;
                    }}
                  />
                  {/* Live badge */}
                  {cam.isLive && (
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/70 border border-red-500/40 backdrop-blur-md">
                      <Radio size={12} className="text-red-400 animate-pulse" />
                      <span className="text-xs font-bold text-red-400 tracking-wide">LIVE</span>
                    </div>
                  )}
                  {/* Category icon */}
                  <div className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center shadow-lg backdrop-blur-md"
                    style={{ background: meta.color + "dd", color: "#000" }}>
                    <meta.icon size={18} />
                  </div>
                </div>

                {/* Info */}
                <div className="p-4 flex flex-col flex-1">
                  <div className="flex-1 mb-4">
                    <h3 className="text-base font-bold text-white leading-snug line-clamp-2 mb-1" style={{ fontFamily: "var(--font-sans)" }}>
                      {cam.name}
                    </h3>
                    <p className="text-sm text-neutral-400 line-clamp-1">{cam.location}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Watch button */}
                    <Link
                      href={`/?cam=${cam.id}`}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-colors"
                      style={{
                        background: `${meta.color}22`,
                        color: meta.color,
                        border: `1px solid ${meta.color}44`,
                      }}
                    >
                      <Map size={16} />
                      Watch on Map
                    </Link>
                    {/* Favorite button */}
                    <button
                      onClick={() => onToggleFavorite(cam.id)}
                      className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition-colors flex-shrink-0 border border-white/5"
                      aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
                    >
                      <Heart
                        size={20}
                        className={isFav ? "text-orange-400 fill-orange-400" : "text-neutral-400"}
                      />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
