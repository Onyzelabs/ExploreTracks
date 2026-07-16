"use client";

import type { AnimalTrack } from "@/lib/types";
import { ANIMAL_TYPE_META } from "@/lib/types";

interface TrackComparePanelProps {
  /** All available tracks (filtered to currently active compare set) */
  tracks: AnimalTrack[];
  /** Currently compared track IDs */
  compareIds: Set<string>;
  onToggleTrack: (id: string) => void;
  onClose: () => void;
}

/**
 * Sidebar panel for multi-track comparison mode.
 * Shows a legend for each compared track and allows toggling tracks on/off.
 */
export default function TrackComparePanel({
  tracks,
  compareIds,
  onToggleTrack,
  onClose,
}: TrackComparePanelProps) {
  const compared = tracks.filter((t) => compareIds.has(t.id));

  return (
    <div className="sidebar-enter flex flex-col h-full bg-[var(--color-surface-800)] border-l border-[var(--glass-border)]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--glass-border)] flex-shrink-0">
        <div>
          <h2 className="text-base font-semibold text-neutral-100" style={{ fontFamily: "var(--font-sans)" }}>
            Track Comparison
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">{compared.length} tracks shown</p>
        </div>
        <button
          id="close-compare-panel"
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-white/10 transition-colors"
          aria-label="Close comparison"
        >
          ✕
        </button>
      </div>

      {/* Track list */}
      <div
        className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-3"
        style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
      >
        {compared.length === 0 && (
          <p className="text-sm text-neutral-500 text-center py-8">
            No tracks selected for comparison.
          </p>
        )}

        {/* Legend cards */}
        {compared.map((track) => {
          const meta = ANIMAL_TYPE_META[track.animalType];
          const start = track.coordinates[0];
          const end = track.coordinates[track.coordinates.length - 1];
          const days = Math.round(
            (end.timestamp - start.timestamp) / (1000 * 60 * 60 * 24),
          );

          return (
            <div
              key={track.id}
              className="rounded-xl border p-3 transition-colors"
              style={{
                borderColor: track.color + "44",
                background: track.color + "08",
              }}
            >
              {/* Track header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor: track.color,
                      boxShadow: `0 0 6px ${track.color}`,
                    }}
                  />
                  <span
                    className="text-sm font-semibold text-neutral-100 truncate"
                    style={{ fontFamily: "var(--font-sans)" }}
                  >
                    {track.individualName}
                  </span>
                  <meta.icon size={16} className="flex-shrink-0" />
                </div>
                <button
                  onClick={() => onToggleTrack(track.id)}
                  className="flex-shrink-0 text-xs px-2 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors ml-2"
                  aria-label={`Remove ${track.individualName} from comparison`}
                >
                  Remove
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-black/20 rounded-lg p-2 text-center">
                  <p className="text-[10px] text-neutral-500 uppercase tracking-wider">Species</p>
                  <p className="text-xs text-neutral-300 font-medium truncate mt-0.5">{track.commonName}</p>
                </div>
                <div className="bg-black/20 rounded-lg p-2 text-center">
                  <p className="text-[10px] text-neutral-500 uppercase tracking-wider">Points</p>
                  <p className="text-xs text-neutral-300 font-semibold mt-0.5">{track.coordinates.length}</p>
                </div>
                <div className="bg-black/20 rounded-lg p-2 text-center">
                  <p className="text-[10px] text-neutral-500 uppercase tracking-wider">Days</p>
                  <p className="text-xs text-neutral-300 font-semibold mt-0.5">{days}</p>
                </div>
              </div>

              {/* Date range */}
              <p className="text-[10px] text-neutral-600 mt-2 text-center">
                {new Date(start.timestamp).toLocaleDateString()} →{" "}
                {new Date(end.timestamp).toLocaleDateString()}
              </p>
            </div>
          );
        })}

        {/* Help text */}
        <div className="mt-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
          <p className="text-xs text-neutral-500">
            Click an animal marker on the map, then click{" "}
            <span className="text-cyan-400 font-semibold">+ Compare</span> in its info panel to
            add more tracks.
          </p>
        </div>
      </div>
    </div>
  );
}
