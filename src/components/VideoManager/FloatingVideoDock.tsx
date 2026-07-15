"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Rnd } from "react-rnd";
import type { ExploreCamera } from "@/lib/types";
import type { LiveChatMessage } from "@/lib/types";
import { CATEGORY_META } from "@/lib/types";
import { useDanmaku } from "@/components/Danmaku/DanmakuOverlay";
import { useYtChat } from "@/lib/hooks";

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
function FloatingVideoPanel({
  camera,
  slot,
  totalOpen,
  onClose,
}: FloatingVideoPanelProps) {
  const danmakuRef = useRef<HTMLDivElement>(null);
  const { shoot } = useDanmaku(danmakuRef);
  const [embedError, setEmbedError] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showDanmaku, setShowDanmaku] = useState(false);

  const handleMessages = useCallback(
    (msgs: LiveChatMessage[]) => msgs.forEach((m) => shoot(m)),
    [shoot],
  );

  useYtChat(camera.youtubeVideoId, {
    onMessages: handleMessages,
    enabled: camera.isLive && !embedError && showDanmaku,
  });

  const meta = CATEGORY_META[camera.category];

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
      className="video-panel flex flex-col w-full h-full"
    >
      {/* Panel header - Draggable area */}
      <div
        className="drag-handle flex items-center gap-2 px-3 py-2 border-b border-white/5 cursor-move select-none"
        style={{ borderColor: `${meta.color}22` }}
      >
        <span className="text-base leading-none pointer-events-none">
          {meta.emoji}
        </span>
        <span
          className="text-base font-bold truncate flex-1"
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
          className="w-5 h-5 flex items-center justify-center text-neutral-500 hover:text-neutral-200 transition-colors text-sm"
          aria-label={isMinimized ? "Expand" : "Minimize"}
        >
          {isMinimized ? "▲" : "▼"}
        </button>
        <button
          id={`close-video-${camera.id}`}
          onClick={() => onClose(camera.id)}
          className="w-5 h-5 flex items-center justify-center text-neutral-500 hover:text-red-400 transition-colors text-sm"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {/* Video content */}
      {!isMinimized && (
        <div
          className="relative flex-1 bg-black overflow-hidden"
          style={{ minHeight: 0 }}
        >
          {embedError ? (
            /* Embedding disabled fallback */
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-neutral-900 p-4 text-center">
              <span className="text-2xl">{meta.emoji}</span>
              <p className="text-sm text-neutral-400 leading-relaxed">
                Embedding is disabled for this stream by the broadcaster.
              </p>
              <a
                href={`https://www.youtube.com/watch?v=${camera.youtubeVideoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm px-3 py-1.5 rounded-lg bg-red-600/20 border border-red-600/40 text-red-400 hover:bg-red-600/30 transition-colors font-medium"
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
              {showDanmaku && (
                <div
                  ref={danmakuRef}
                  className="danmaku-container"
                  aria-hidden
                />
              )}
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
          <span className="text-[10px] text-neutral-500">
            {camera.location}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Manager ─────────────────────────────────────────────────────────────────

import type { OpenVideoPanel } from "@/lib/types";

interface FloatingVideoDockProps {
  openPanels: OpenVideoPanel[];
  onClose: (id: string) => void;
}

export default function FloatingVideoDock({
  openPanels,
  onClose,
}: FloatingVideoDockProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || openPanels.length === 0) return null;

  const getInitialLayout = (slot: number, total: number) => {
    // Determine a responsive width based on screen size
    const isMobile = window.innerWidth < 768;
    const baseWidth =
      total === 1 ? (isMobile ? 300 : 420) : isMobile ? 260 : 320;
    const height = baseWidth * 0.5625 + 40; // 16:9 ratio + header height

    const paddingX = 16;
    const paddingY = 32;
    const gap = 16;

    // Arrange in a grid starting from bottom-right!
    // Estimate how many columns fit on screen
    const maxCols = Math.max(
      1,
      Math.floor((window.innerWidth - paddingX * 2) / (baseWidth + gap)),
    );

    const col = slot % maxCols;
    const row = Math.floor(slot / maxCols);

    // Calculate grid position from bottom right
    let x = window.innerWidth - paddingX - (col + 1) * baseWidth - col * gap;
    let y = window.innerHeight - paddingY - (row + 1) * height - row * gap;

    // Safety fallback clamp (in case screen is weirdly small)
    x = Math.max(0, x);
    y = Math.max(0, y);

    return { x, y, width: baseWidth, height };
  };

  return (
    <div
      id="floating-video-dock"
      className="fixed inset-0 z-50 pointer-events-none"
    >
      {openPanels.map((panel) => {
        const layout = getInitialLayout(panel.slot, openPanels.length);
        return (
          <Rnd
            key={panel.camera.id}
            default={{
              x: layout.x,
              y: layout.y,
              width: layout.width,
              height: layout.height,
            }}
            minWidth={240}
            minHeight={175}
            bounds="window"
            dragHandleClassName="drag-handle"
            style={{ pointerEvents: "auto", position: "absolute" }}
          >
            <FloatingVideoPanel
              camera={panel.camera}
              slot={panel.slot}
              totalOpen={openPanels.length}
              onClose={onClose}
            />
          </Rnd>
        );
      })}
    </div>
  );
}

export { MAX_PANELS };
