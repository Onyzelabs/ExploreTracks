"use client";

import { useEffect, useState } from "react";

import type { AnimalTrack } from "@/lib/types";

interface AnimalInfoProps {
  track: AnimalTrack;
  onClose: () => void;
}

export default function AnimalInfo({ track, onClose }: AnimalInfoProps) {
  const start = track.coordinates[0];
  const end = track.coordinates[track.coordinates.length - 1];
  const startDate = new Date(start.timestamp).toLocaleDateString();
  const endDate = new Date(end.timestamp).toLocaleDateString();

  const [imageUrl, setImageUrl] = useState<string | null>(null);

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

    return () => {
      active = false;
    };
  }, [track.species]);

  // Rough distance in km between first and last point (haversine)
  const distKm = haversine(
    start.latitude,
    start.longitude,
    end.latitude,
    end.longitude,
  );

  return (
    <div className="sidebar-enter flex flex-col h-full bg-[var(--color-surface-800)] border-l border-[var(--glass-border)]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--glass-border)]">
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
        <button
          id={`close-animal-panel-${track.id}`}
          onClick={onClose}
          className="flex-shrink-0 ml-2 w-7 h-7 flex items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-white/10 transition-colors"
          aria-label="Close panel"
        >
          ✕
        </button>
      </div>

      {/* Telemetry Notice */}
      <div className="px-4 pt-4">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm mb-4">
          <span>📡</span>
          <span>
            <b>Telemetry Data Only:</b> This is GPS tracking data from Movebank,
            not a video feed.
          </span>
        </div>

        {imageUrl && (
          <div className="w-full h-40 rounded-xl overflow-hidden mb-4 border border-[var(--glass-border)] bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={track.commonName}
              className="w-full h-full object-cover anim-fade-in"
            />
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 p-4">
        <StatCard
          label="Track Points"
          value={track.coordinates.length.toString()}
        />
        <StatCard label="Distance" value={`~${distKm.toFixed(0)} km`} />
        <StatCard label="Start Date" value={startDate} />
        <StatCard label="Latest Fix" value={endDate} />
      </div>

      {/* Details */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
        <div>
          <p className="text-sm text-neutral-500 uppercase tracking-wider mb-1">
            Species
          </p>
          <p className="text-base text-neutral-200 font-medium">
            {track.commonName}
          </p>
          <p className="text-sm text-neutral-500 italic">{track.species}</p>
        </div>

        <div>
          <p className="text-sm text-neutral-500 uppercase tracking-wider mb-1">
            Study
          </p>
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
          <p className="text-sm text-neutral-500 uppercase tracking-wider mb-2">
            Tags
          </p>
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

function haversine(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
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
