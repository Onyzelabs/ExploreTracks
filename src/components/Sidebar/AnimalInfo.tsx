"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import type { AnimalTrack } from "@/lib/types";

interface AnimalInfoProps {
  track: AnimalTrack;
  onClose: () => void;
  /** Called when the user scrubs the timeline; passes the active point index */
  onPlaybackIndex?: (index: number | null) => void;
  /** Called when the user wants to add this track to comparison mode */
  onCompare?: (track: AnimalTrack) => void;
}

export default function AnimalInfo({ track, onClose, onPlaybackIndex, onCompare }: AnimalInfoProps) {
  const start = track.coordinates[0];
  const end = track.coordinates[track.coordinates.length - 1];
  const startDate = new Date(start.timestamp).toLocaleDateString();
  const endDate = new Date(end.timestamp).toLocaleDateString();

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [playbackIdx, setPlaybackIdx] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<0.5 | 1 | 2 | 5>(1);
  const playIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Reset playback when track changes
  useEffect(() => {
    setPlaybackIdx(null);
    setIsPlaying(false);
    onPlaybackIndex?.(null);
  }, [track.id]);

  // Fetch Wikipedia image
  useEffect(() => {
    let active = true;
    setImageUrl(null);
    if (!track.species || track.species === "Unknown") return;

    fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(track.species)}`,
    )
      .then((r) => r.json())
      .then((data) => {
        if (active && data.thumbnail?.source) {
          setImageUrl(data.thumbnail.source);
        }
      })
      .catch((err) => console.error("Wiki fetch error:", err));

    return () => { active = false; };
  }, [track.species]);

  // Auto-play: advance index every (200 / speed) ms
  useEffect(() => {
    if (!isPlaying) {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
      return;
    }

    const total = track.coordinates.length;
    let idx = playbackIdx ?? 0;

    playIntervalRef.current = setInterval(() => {
      idx = idx + 1;
      if (idx >= total) {
        idx = total - 1;
        setIsPlaying(false);
      }
      setPlaybackIdx(idx);
      onPlaybackIndex?.(idx);
    }, Math.round(200 / playbackSpeed));

    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    };
  }, [isPlaying, track.coordinates.length, playbackSpeed]);

  const handleScrub = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const idx = parseInt(e.target.value, 10);
    setPlaybackIdx(idx);
    onPlaybackIndex?.(idx);
  }, [onPlaybackIndex]);

  const handlePlayPause = useCallback(() => {
    // If at end, restart from beginning
    if (!isPlaying && playbackIdx === track.coordinates.length - 1) {
      setPlaybackIdx(0);
      onPlaybackIndex?.(0);
    }
    setIsPlaying((v) => !v);
  }, [isPlaying, playbackIdx, track.coordinates.length, onPlaybackIndex]);

  const handleReset = useCallback(() => {
    setIsPlaying(false);
    setPlaybackIdx(null);
    onPlaybackIndex?.(null);
  }, [onPlaybackIndex]);

  // The point currently shown (null = show full track)
  const activePoint =
    playbackIdx !== null ? track.coordinates[playbackIdx] : null;

  const distKm = haversine(
    start.latitude,
    start.longitude,
    end.latitude,
    end.longitude,
  );

  const total = track.coordinates.length;
  const pct = playbackIdx !== null ? (playbackIdx / (total - 1)) * 100 : 100;

  return (
    <div className="sidebar-enter flex flex-col h-full bg-[var(--color-surface-800)] border-l border-[var(--glass-border)]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--glass-border)] flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="flex-shrink-0 w-3 h-3 rounded-full ring-2 ring-offset-1 ring-offset-[var(--color-surface-800)]"
            style={{
              backgroundColor: track.color,
              boxShadow: `0 0 8px ${track.color}`,
            }}
          />
          <h2 className="text-base font-semibold text-neutral-100 truncate">
            {track.individualName}{" "}
            <span className="text-neutral-400 font-normal">
              ({track.commonName})
            </span>
          </h2>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          {onCompare && (
            <button
              id={`compare-animal-${track.id}`}
              onClick={() => onCompare(track)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors"
              title="Add to track comparison"
            >
              + Compare
            </button>
          )}
          <button
            id={`close-animal-panel-${track.id}`}
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-white/10 transition-colors"
            aria-label="Close panel"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div
        className="flex-1 overflow-y-auto overscroll-contain px-4 pb-8 space-y-4"
        style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
      >
        {/* Telemetry Notice */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm mt-4">
          <span>📡</span>
          <span>
            <b>Telemetry Data Only:</b> GPS tracking data from Movebank, not a
            video feed.
          </span>
        </div>

        {imageUrl && (
          <div className="w-full h-40 rounded-xl overflow-hidden border border-[var(--glass-border)] bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={track.commonName}
              className="w-full h-full object-cover anim-fade-in"
            />
          </div>
        )}

        {/* ── Track Playback ─────────────────────────────────────────── */}
        <div
          className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-3"
          id={`track-playback-${track.id}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">
              Track Playback
            </span>
            <span className="text-xs text-neutral-500">
              {playbackIdx !== null ? `${playbackIdx + 1} / ${total}` : `${total} pts`}
            </span>
          </div>

          {/* Scrubber */}
          <div className="relative">
            <input
              type="range"
              min={0}
              max={total - 1}
              step={1}
              value={playbackIdx ?? total - 1}
              onChange={handleScrub}
              className="w-full h-1.5 appearance-none rounded-full cursor-pointer"
              style={{
                background: `linear-gradient(to right, ${track.color} ${pct}%, rgba(255,255,255,0.1) ${pct}%)`,
                accentColor: track.color,
              }}
              aria-label="Track playback scrubber"
            />
          </div>

          {/* Time info */}
          <div className="flex items-center justify-between text-[11px] text-neutral-500">
            <span>{new Date(start.timestamp).toLocaleDateString()}</span>
            <span>
              {activePoint
                ? new Date(activePoint.timestamp).toLocaleString([], {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : new Date(end.timestamp).toLocaleDateString()}
            </span>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handlePlayPause}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={{
                background: isPlaying ? `${track.color}22` : `${track.color}33`,
                color: track.color,
                border: `1px solid ${track.color}44`,
              }}
              aria-label={isPlaying ? "Pause playback" : "Play playback"}
            >
              {isPlaying ? "⏸ Pause" : "▶ Play"}
            </button>
            <button
              onClick={handleReset}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 text-neutral-400 hover:text-white border border-white/10 transition-colors"
              aria-label="Reset to full track"
            >
              Reset
            </button>
            {/* Speed selector */}
            <div className="ml-auto flex items-center gap-1">
              {([0.5, 1, 2, 5] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setPlaybackSpeed(s)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors border ${
                    playbackSpeed === s
                      ? "bg-white/15 text-white border-white/30"
                      : "bg-transparent text-neutral-600 border-transparent hover:text-neutral-400"
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Track Points" value={total.toString()} />
          <StatCard label="Distance" value={`~${distKm.toFixed(0)} km`} />
          <StatCard label="Start Date" value={startDate} />
          <StatCard label="Latest Fix" value={endDate} />
        </div>

        {/* Details */}
        <div>
          <p className="text-sm text-neutral-500 uppercase tracking-wider mb-1">Species</p>
          <p className="text-base text-neutral-200 font-medium">{track.commonName}</p>
          <p className="text-sm text-neutral-500 italic">{track.species}</p>
        </div>

        <div>
          <p className="text-sm text-neutral-500 uppercase tracking-wider mb-1">Study</p>
          <p className="text-base text-neutral-300">{track.studyName}</p>
        </div>

        {track.currentPosition && (
          <div>
            <p className="text-sm text-neutral-500 uppercase tracking-wider mb-1">
              Current Position
            </p>
            <p className="text-sm text-neutral-400 font-mono">
              {track.currentPosition[1].toFixed(4)}°N,{" "}
              {track.currentPosition[0].toFixed(4)}°E
            </p>
          </div>
        )}

        <div>
          <p className="text-sm text-neutral-500 uppercase tracking-wider mb-2">Tags</p>
          <div className="flex flex-wrap gap-2">
            {track.tags.map((tag) => (
              <span
                key={tag}
                className="text-sm px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <a
          id={`movebank-link-${track.id}`}
          href="https://www.movebank.org"
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full text-center py-2.5 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 text-base font-semibold hover:bg-cyan-500/30 hover:border-cyan-500/60 transition-all duration-200"
        >
          View on Movebank ↗
        </a>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-card p-3">
      <p className="text-sm text-neutral-500 mb-0.5">{label}</p>
      <p className="text-base font-semibold text-neutral-100">{value}</p>
    </div>
  );
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
