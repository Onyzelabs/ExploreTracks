"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Rnd } from "react-rnd";
import type { ExploreCamera, LiveChatMessage, OpenVideoPanel } from "@/lib/types";
import { CATEGORY_META } from "@/lib/types";
import { useDanmaku } from "@/components/Danmaku/DanmakuOverlay";
import { useYtChat } from "@/lib/hooks";

// ─── Shared Panel Content ─────────────────────────────────────────────────────

interface FloatingVideoPanelProps {
  camera: ExploreCamera;
  slot: number;
  totalOpen: number;
  onClose: (id: string) => void;
  /** In mobile tray mode the header is not a drag handle */
  mobile?: boolean;
}

function FloatingVideoPanel({
  camera,
  slot,
  totalOpen,
  onClose,
  mobile = false,
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
      {/* Header */}
      <div
        className={`${mobile ? "" : "drag-handle"} flex items-center gap-2 px-3 py-2 border-b border-white/5 ${mobile ? "cursor-default" : "cursor-move"} select-none flex-shrink-0`}
        style={{ borderColor: `${meta.color}22` }}
      >
        <span className="text-base leading-none pointer-events-none">{meta.emoji}</span>
        <span
          className="text-sm font-bold truncate flex-1"
          style={{ fontFamily: "var(--font-sans)", color: meta.color }}
        >
          {camera.name}
        </span>

        {camera.isLive && !embedError && (
          <span className="flex items-center gap-1 text-[10px] text-red-400 font-semibold flex-shrink-0">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            LIVE
          </span>
        )}

        {/* Danmaku toggle — hidden on mobile to save header space */}
        {!mobile && (
          <button
            onClick={() => setShowDanmaku((v) => !v)}
            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${showDanmaku ? "bg-cyan-500/20 text-cyan-400" : "bg-neutral-800 text-neutral-500"}`}
            title="Toggle Chat Danmaku"
          >
            💬 {showDanmaku ? "ON" : "OFF"}
          </button>
        )}

        {/* Minimize — desktop only */}
        {!mobile && (
          <button
            id={`minimize-video-${camera.id}`}
            onClick={() => setIsMinimized((v) => !v)}
            className="w-7 h-7 flex items-center justify-center text-neutral-500 hover:text-neutral-200 transition-colors text-sm"
            aria-label={isMinimized ? "Expand" : "Minimize"}
          >
            {isMinimized ? "▲" : "▼"}
          </button>
        )}

        {/* Close — large tap target on mobile */}
        <button
          id={`close-video-${camera.id}`}
          onClick={(e) => {
            e.stopPropagation();
            onClose(camera.id);
          }}
          className={`${mobile ? "w-10 h-10 text-base" : "w-7 h-7 text-sm"} flex items-center justify-center text-neutral-400 hover:text-red-400 active:text-red-500 transition-colors rounded-lg`}
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {/* Video content */}
      {!isMinimized && (
        <div className="relative flex-1 bg-black overflow-hidden" style={{ minHeight: 0 }}>
          {embedError ? (
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
              {showDanmaku && (
                <div ref={danmakuRef} className="danmaku-container" aria-hidden />
              )}
            </>
          )}
        </div>
      )}

      {/* Minimized strip (desktop only) */}
      {isMinimized && !mobile && (
        <div
          className="h-10 flex items-center px-3 gap-2"
          style={{ background: `linear-gradient(90deg, ${meta.color}18, transparent)` }}
        >
          <span className="text-[10px] text-neutral-500">{camera.location}</span>
        </div>
      )}
    </div>
  );
}

// ─── Mobile Tray ──────────────────────────────────────────────────────────────
// On mobile: show videos as full-width stacked cards in a scrollable bottom tray.

interface MobileVideoTrayProps {
  openPanels: OpenVideoPanel[];
  onClose: (id: string) => void;
}

function MobileVideoTray({ openPanels, onClose }: MobileVideoTrayProps) {
  const [activeIdx, setActiveIdx] = useState(0);

  // Clamp active index when panels close
  useEffect(() => {
    if (activeIdx >= openPanels.length) {
      setActiveIdx(Math.max(0, openPanels.length - 1));
    }
  }, [openPanels.length, activeIdx]);

  if (openPanels.length === 0) return null;

  const active = openPanels[activeIdx] ?? openPanels[0];

  return (
    <div
      id="mobile-video-tray"
      className="fixed bottom-0 left-0 right-0 z-[150] bg-[var(--color-surface-900)] border-t border-white/10 shadow-2xl flex flex-col"
      style={{ height: "56vw", maxHeight: "62vh", minHeight: "200px" }}
    >
      {/* Tab bar when multiple panels open */}
      {openPanels.length > 1 && (
        <div className="flex items-center gap-1 px-2 pt-1 overflow-x-auto flex-shrink-0">
          {openPanels.map((panel, idx) => {
            const meta = CATEGORY_META[panel.camera.category];
            return (
              <button
                key={panel.camera.id}
                onClick={() => setActiveIdx(idx)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-t-lg text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                  idx === activeIdx
                    ? "bg-white/10 text-white"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                <span>{meta.emoji}</span>
                <span className="max-w-[100px] truncate">{panel.camera.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Active panel */}
      <div className="flex-1 min-h-0">
        <FloatingVideoPanel
          key={active.camera.id}
          camera={active.camera}
          slot={active.slot}
          totalOpen={openPanels.length}
          onClose={onClose}
          mobile
        />
      </div>
    </div>
  );
}

// ─── Desktop Floating Dock ────────────────────────────────────────────────────

interface FloatingVideoDockProps {
  openPanels: OpenVideoPanel[];
  onClose: (id: string) => void;
}

export default function FloatingVideoDock({ openPanels, onClose }: FloatingVideoDockProps) {
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setMounted(true);
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (!mounted || openPanels.length === 0) return null;

  // ── Mobile: use tray instead of floating windows ────────────────────────────
  if (isMobile) {
    return <MobileVideoTray openPanels={openPanels} onClose={onClose} />;
  }

  // ── Desktop: draggable Rnd panels ──────────────────────────────────────────
  const getInitialLayout = (slot: number) => {
    const baseWidth = 320;
    const height = baseWidth * 0.5625 + 40;
    const paddingX = 16;
    const paddingY = 32;
    const gap = 16;

    const maxCols = Math.max(
      1,
      Math.floor((window.innerWidth - paddingX * 2) / (baseWidth + gap)),
    );

    const col = slot % maxCols;
    const row = Math.floor(slot / maxCols);

    let x = window.innerWidth - paddingX - (col + 1) * baseWidth - col * gap;
    let y = window.innerHeight - paddingY - (row + 1) * height - row * gap;

    x = Math.max(0, x);
    y = Math.max(0, y);

    return { x, y, width: baseWidth, height };
  };

  return (
    <div id="floating-video-dock" className="fixed inset-0 z-50 pointer-events-none">
      {openPanels.map((panel) => {
        const layout = getInitialLayout(panel.slot);
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
