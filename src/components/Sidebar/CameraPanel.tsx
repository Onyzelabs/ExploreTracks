"use client";

import { useRef, useCallback } from "react";
import type { ExploreCamera } from "@/lib/types";
import type { LiveChatMessage } from "@/lib/types";
import { useDanmaku } from "@/components/Danmaku/DanmakuOverlay";
import { useYtChat } from "@/lib/hooks";

interface CameraPanelProps {
  camera: ExploreCamera;
  onClose: () => void;
}

export default function CameraPanel({ camera, onClose }: CameraPanelProps) {
  const danmakuContainerRef = useRef<HTMLDivElement>(null);
  const { shoot } = useDanmaku(danmakuContainerRef);

  // Fire each incoming message as a danmaku bullet
  const handleMessages = useCallback(
    (messages: LiveChatMessage[]) => {
      messages.forEach((msg) => shoot(msg));
    },
    [shoot],
  );

  // Poll YouTube Live Chat API for this camera's stream
  const { isLive } = useYtChat(camera.youtubeVideoId, {
    onMessages: handleMessages,
    enabled: camera.isLive,
  });

  return (
    <div className="sidebar-enter flex flex-col h-full bg-[var(--color-surface-800)] border-l border-[var(--glass-border)]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--glass-border)]">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex-shrink-0 flex items-center gap-1.5 bg-red-600/20 border border-red-500/40 text-red-400 text-sm font-semibold px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            {isLive ? "LIVE" : "STREAM"}
          </span>
          <h2 className="text-base font-semibold text-neutral-100 truncate">
            {camera.name}
          </h2>
        </div>
        <button
          id={`close-camera-panel-${camera.id}`}
          onClick={onClose}
          className="flex-shrink-0 ml-2 w-7 h-7 flex items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-white/10 transition-colors"
          aria-label="Close panel"
        >
          ✕
        </button>
      </div>

      {/* Video + Danmaku */}
      <div className="relative flex-shrink-0 aspect-video bg-black">
        <iframe
          src={camera.embedUrl}
          title={`${camera.name} live stream`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full h-full"
          loading="lazy"
        />
        {/* Danmaku overlay — pointer-events:none so clicks pass through to iframe */}
        <div
          ref={danmakuContainerRef}
          className="danmaku-container"
          aria-hidden="true"
        />
      </div>

      {/* Danmaku status indicator */}
      <div className="px-4 pt-3 flex items-center gap-2">
        <span className="text-sm text-neutral-500">
          {isLive
            ? "💬 Live chat → danmaku (via YouTube Data API)"
            : "⏸ Stream offline — danmaku paused"}
        </span>
      </div>

      {/* Camera Info */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <p className="text-sm text-neutral-500 uppercase tracking-wider mb-1">
            Location
          </p>
          <p className="text-base text-neutral-200 font-medium">
            📍 {camera.location}, {camera.country}
          </p>
        </div>

        <div>
          <p className="text-sm text-neutral-500 uppercase tracking-wider mb-1">
            Description
          </p>
          <p className="text-base text-neutral-300 leading-relaxed">
            {camera.description}
          </p>
        </div>

        <div>
          <p className="text-sm text-neutral-500 uppercase tracking-wider mb-1">
            Coordinates
          </p>
          <p className="text-sm text-neutral-400 font-mono">
            {camera.coordinates[1].toFixed(4)}°N,{" "}
            {camera.coordinates[0].toFixed(4)}°E
          </p>
        </div>

        <div>
          <p className="text-sm text-neutral-500 uppercase tracking-wider mb-1">
            Category
          </p>
          <span className="inline-block text-sm px-2.5 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-400 capitalize font-medium">
            {camera.category}
          </span>
        </div>

        <a
          id={`explore-link-${camera.id}`}
          href={`https://explore.org`}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full text-center py-2.5 rounded-xl bg-orange-500/20 border border-orange-500/40 text-orange-400 text-base font-semibold hover:bg-orange-500/30 hover:border-orange-500/60 transition-all duration-200"
        >
          View on explore.org ↗
        </a>
      </div>
    </div>
  );
}
