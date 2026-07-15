"use client";

import { useState, useCallback, useRef } from "react";
import type { ExploreCamera } from "@/lib/types";
import type { LiveChatMessage } from "@/lib/types";
import { CATEGORY_META } from "@/lib/types";
import { useDanmaku } from "@/components/Danmaku/DanmakuOverlay";
import { useYtChat } from "@/lib/hooks";

const MAX_PANELS = 4;

interface FloatingVideoPanelProps {
  camera: ExploreCamera;
  slot: number;
  totalOpen: number;
  onClose: (id: string) => void;
}

/**
 * One floating video panel. Handles its own danmaku + YouTube chat polling.
 * Embed URL: mute=1 for autoplay compliance, origin for JS API, rel=0 for clean UI.
 */
function FloatingVideoPanel({ camera, slot, totalOpen, onClose }: FloatingVideoPanelProps) {
  const danmakuRef = useRef<HTMLDivElement>(null);
  const { shoot } = useDanmaku(danmakuRef);
  const [embedError, setEmbedError] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showDanmaku, setShowDanmaku] = useState(false);

  const handleMessages = useCallback(
    (msgs: LiveChatMessage[]) => msgs.forEach((m) => shoot(m)),
    [shoot]
  );

  useYtChat(camera.youtubeVideoId, {
    onMessages: handleMessages,
    enabled: camera.isLive && !embedError && showDanmaku,
  });

  const meta = CATEGORY_META[camera.category];

  // Build a properly-scoped embed URL
  const embedUrl = [
    `https://www.youtube.com/embed/${camera.youtubeVideoId}`,
    "?autoplay=1",
    "&mute=1",
    "&rel=0",
    "&modestbranding=1",
    "&enablejsapi=1",
    `&origin=${typeof window !== "undefined" ? window.location.origin : ""}`,
  ].join("");

  return (
    <div
      id={`video-panel-${camera.id}`}
      className="video-panel flex flex-col"
      style={{ width: totalOpen === 1 ? 420 : 320 }}
    >
      {/* Panel header */}
      <div
        className="flex items-center gap-2 px-3 py-2 border-b border-white/5 cursor-default select-none"
        style={{ borderColor: `${meta.color}22` }}
      >
        <span className="text-base leading-none">{meta.emoji}</span>
        <span
          className="text-sm font-bold truncate flex-1"
          style={{ fontFamily: "var(--font-sans)", color: meta.color }}
        >
          {camera.name}
        </span>
        {/* Live dot */}
        {camera.isLive && !embedError && (
          <span className="flex items-center gap-1 text-[10px] text-red-400 font-semibold flex-shrink-0">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            LIVE
          </span>
        )}
        <button
          onClick={() => setShowDanmaku((v) => !v)}
          className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${showDanmaku ? "bg-cyan-500/20 text-cyan-400" : "bg-neutral-800 text-neutral-500"}`}
          title="Toggle Chat Danmaku"
        >
          💬 {showDanmaku ? "ON" : "OFF"}
        </button>
        <button
          id={`minimize-video-${camera.id}`}
          onClick={() => setIsMinimized((v) => !v)}
          className="w-5 h-5 flex items-center justify-center text-neutral-500 hover:text-neutral-200 transition-colors text-xs"
          aria-label={isMinimized ? "Expand" : "Minimize"}
        >
          {isMinimized ? "▲" : "▼"}
        </button>
        <button
          id={`close-video-${camera.id}`}
          onClick={() => onClose(camera.id)}
          className="w-5 h-5 flex items-center justify-center text-neutral-500 hover:text-red-400 transition-colors text-xs"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {/* Video content */}
      {!isMinimized && (
        <div className="relative" style={{ aspectRatio: "16/9" }}>
          {embedError ? (
            /* Embedding disabled fallback */
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-neutral-900 p-4 text-center">
              <span className="text-2xl">{meta.emoji}</span>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Embedding is disabled for this stream by the broadcaster.
              </p>
              <a
                href={`https://www.youtube.com/watch?v=${camera.youtubeVideoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-3 py-1.5 rounded-lg bg-red-600/20 border border-red-600/40 text-red-400 hover:bg-red-600/30 transition-colors font-medium"
              >
                Watch on YouTube ↗
              </a>
            </div>
          ) : (
            <>
              <iframe
                src={embedUrl}
                title={camera.name}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="w-full h-full"
                loading="lazy"
                onError={() => setEmbedError(true)}
              />
              {/* Danmaku overlay */}
              {showDanmaku && <div ref={danmakuRef} className="danmaku-container" aria-hidden />}
            </>
          )}
        </div>
      )}

      {/* Minimized thumbnail strip */}
      {isMinimized && (
        <div
          className="h-10 flex items-center px-3 gap-2"
          style={{
            background: `linear-gradient(90deg, ${meta.color}18, transparent)`,
          }}
        >
          <span className="text-[10px] text-neutral-500">{camera.location}</span>
        </div>
      )}
    </div>
  );
}

// ─── Manager ─────────────────────────────────────────────────────────────────

interface FloatingVideoDockProps {
  openPanels: ExploreCamera[];
  onClose: (id: string) => void;
}

export default function FloatingVideoDock({ openPanels, onClose }: FloatingVideoDockProps) {
  if (openPanels.length === 0) return null;

  return (
    <div
      id="floating-video-dock"
      className="absolute bottom-8 right-4 z-30 flex flex-row-reverse flex-wrap-reverse gap-3 items-end"
      style={{ maxWidth: "calc(100vw - 2rem)", pointerEvents: "none" }}
    >
      {openPanels.map((cam, i) => (
        <div key={cam.id} style={{ pointerEvents: "auto" }}>
          <FloatingVideoPanel
            camera={cam}
            slot={i}
            totalOpen={openPanels.length}
            onClose={onClose}
          />
        </div>
      ))}
    </div>
  );
}

export { MAX_PANELS };
