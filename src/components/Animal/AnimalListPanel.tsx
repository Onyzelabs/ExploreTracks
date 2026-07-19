"use client";

import { useState, useMemo } from "react";
import type { AnimalTrack } from "@/lib/types";
import { ANIMAL_TYPE_META } from "@/lib/types";
import { Search, X, Map } from "lucide-react";

interface AnimalListPanelProps {
  tracks: AnimalTrack[];
  onSelect: (track: AnimalTrack) => void;
  onClose: () => void;
}

export default function AnimalListPanel({
  tracks,
  onSelect,
  onClose,
}: AnimalListPanelProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return tracks.filter(
      (t) =>
        t.individualName?.toLowerCase().includes(q) ||
        t.commonName?.toLowerCase().includes(q) ||
        t.species?.toLowerCase().includes(q)
    );
  }, [tracks, search]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6" style={{ fontFamily: "var(--font-sans)" }}>
      <div className="bg-[var(--color-surface-950)] border border-[var(--glass-border)] rounded-2xl shadow-2xl flex flex-col w-full max-w-5xl h-[85vh] sm:h-[80vh] overflow-hidden anim-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:px-6 border-b border-[var(--glass-border)] bg-[var(--color-surface-900)]">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Movebank Tracks
            </h2>
            <p className="text-sm text-neutral-400 mt-0.5">
              {filtered.length} tracks available
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 sm:px-6 border-b border-[var(--glass-border)] bg-[var(--color-surface-900)]/50">
          <div className="relative max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              placeholder="Search by name or species..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-neutral-400 focus:outline-none focus:border-cyan-500/50 transition-all"
            />
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filtered.map((track) => {
              const meta = ANIMAL_TYPE_META[track.animalType] || ANIMAL_TYPE_META.unknown;
              const Icon = meta.icon;

              return (
                <div
                  key={track.id}
                  className="flex flex-col rounded-2xl border border-[var(--glass-border)] bg-[var(--color-surface-800)] hover:border-cyan-500/30 transition-all group overflow-hidden"
                >
                  <div className="p-4 flex flex-col flex-1">
                    {/* Top Row: Icon + Names */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full shadow-lg backdrop-blur-md"
                          style={{ background: meta.color + "dd", color: "#000" }}
                        >
                          <Icon size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-base font-bold text-white truncate">
                            {track.individualName || track.commonName || "Unknown"}
                          </h3>
                          <p className="text-sm text-neutral-400 truncate">
                            {track.species}
                          </p>
                        </div>
                      </div>
                      <div
                        className="w-3 h-3 flex-shrink-0 rounded-full border border-black/50 shadow-sm mt-1 ml-2"
                        style={{ backgroundColor: track.color }}
                        title="Track color"
                      />
                    </div>

                    <div className="flex-1 mb-4">
                      <p className="text-xs text-neutral-500 line-clamp-2" title={track.studyName}>
                        {track.studyName}
                      </p>
                    </div>

                    {/* Action */}
                    <button
                      onClick={() => onSelect(track)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-colors"
                      style={{
                        background: `${meta.color}22`,
                        color: meta.color,
                        border: `1px solid ${meta.color}44`,
                      }}
                    >
                      <Map size={16} />
                      Track
                    </button>
                  </div>
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="col-span-full py-20 text-center text-neutral-500 text-lg">
                No tracks found matching &quot;{search}&quot;.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
