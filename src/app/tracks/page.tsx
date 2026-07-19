"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, ArrowLeft, Map, HelpCircle } from "lucide-react";
import { useTracks } from "@/lib/hooks";
import { ANIMAL_TYPE_META } from "@/lib/types";
import { useWikipediaImage } from "@/lib/useWikipediaImage";

function AnimalImage({ species, color }: { species: string; color: string }) {
  const imgUrl = useWikipediaImage(species);

  if (!imgUrl) {
    return (
      <div
        className="w-full h-32 flex items-center justify-center opacity-30"
        style={{ backgroundColor: color + "22" }}
      >
        <HelpCircle size={32} color={color} />
      </div>
    );
  }

  return (
    <div className="relative w-full h-32 bg-black/50 overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imgUrl}
        alt=""
        className="absolute inset-0 w-full h-full object-cover blur-xl opacity-40 scale-125"
        aria-hidden="true"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imgUrl}
        alt={species}
        className="relative w-full h-full object-contain drop-shadow-2xl"
      />
    </div>
  );
}

export default function TracksPage() {
  const router = useRouter();
  const { tracks, isLoading, error } = useTracks();
  
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!tracks) return [];
    const q = search.toLowerCase();
    
    // Filter
    const matched = tracks.filter(
      (t) =>
        t.individualName?.toLowerCase().includes(q) ||
        t.commonName?.toLowerCase().includes(q) ||
        t.species?.toLowerCase().includes(q) ||
        t.studyName?.toLowerCase().includes(q)
    );
    
    // Sort OBIS data to the top
    return matched.sort((a, b) => {
      const aIsObis = a.id.startsWith("obis-") || a.studyName.includes("OBIS");
      const bIsObis = b.id.startsWith("obis-") || b.studyName.includes("OBIS");
      if (aIsObis && !bIsObis) return -1;
      if (!aIsObis && bIsObis) return 1;
      return 0;
    });
  }, [tracks, search]);

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
                Movebank & OBIS Tracks
              </h1>
              <p className="text-sm text-neutral-400">
                {isLoading ? "Loading..." : `${tracks?.length || 0} tracked animals`}
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
                placeholder="Search tracks..."
                className="w-full sm:w-64 bg-black/40 border border-white/10 rounded-full pl-10 pr-4 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500/50 transition-all"
                style={{ fontFamily: "var(--font-sans)" }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 mb-8">
            Failed to load tracks: {error.message}
          </div>
        )}

        {filtered.length === 0 && !isLoading && !error && (
          <div className="text-center py-20 text-neutral-500 text-lg">
            No tracks found matching your search.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {filtered.map((track) => {
            const meta = ANIMAL_TYPE_META[track.animalType] || ANIMAL_TYPE_META.unknown;
            const Icon = meta.icon;

            return (
              <div
                key={track.id}
                className="flex flex-col rounded-2xl border border-[var(--glass-border)] bg-[var(--color-surface-800)] hover:border-cyan-500/50 transition-all group overflow-hidden shadow-lg hover:shadow-cyan-500/10"
              >
                {/* Animal Image */}
                <div className="relative w-full h-32 bg-black/40 overflow-hidden">
                  <AnimalImage species={track.species} color={meta.color} />
                  <div
                    className="absolute top-2 right-2 w-3 h-3 rounded-full border border-black/50 shadow-sm"
                    style={{ backgroundColor: track.color }}
                    title="Track color"
                  />
                  <div
                    className="absolute bottom-2 left-2 w-8 h-8 flex items-center justify-center rounded-full shadow-lg backdrop-blur-md"
                    style={{ background: meta.color + "dd", color: "#000" }}
                  >
                    <Icon size={16} />
                  </div>
                </div>

                <div className="p-4 flex flex-col flex-1">
                  {/* Names */}
                  <div className="mb-2">
                    <h3 className="text-base font-bold text-white truncate group-hover:text-cyan-400 transition-colors" style={{ fontFamily: "var(--font-sans)" }}>
                      {track.individualName || track.commonName || "Unknown"}
                    </h3>
                    <p className="text-sm text-neutral-400 truncate">
                      {track.species}
                    </p>
                  </div>

                  <div className="flex-1 mb-4">
                    <p className="text-xs text-neutral-500 line-clamp-2" title={track.studyName}>
                      {track.studyName}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="mt-auto">
                    <Link
                      href={`/?track=${track.id}`}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-bold transition-all hover:scale-[1.02]"
                      style={{
                        background: `${meta.color}15`,
                        color: meta.color,
                        border: `1px solid ${meta.color}30`,
                      }}
                    >
                      <Map size={16} />
                      View on Map
                    </Link>
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
