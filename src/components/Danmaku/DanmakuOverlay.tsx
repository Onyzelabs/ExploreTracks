"use client";

import { useCallback, useRef } from "react";
import type { LiveChatMessage } from "@/lib/types";

const TRACK_COUNT = 12; // Number of danmaku lanes

interface DanmakuOverlayProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

// Track which vertical lane each danmaku item occupies to avoid collisions
const laneTimestamps: number[] = new Array(TRACK_COUNT).fill(0);

function getFreeLane(): number {
  const now = Date.now();
  let freeLane = 0;
  let oldestTime = Infinity;
  for (let i = 0; i < TRACK_COUNT; i++) {
    if (laneTimestamps[i] < oldestTime) {
      oldestTime = laneTimestamps[i];
      freeLane = i;
    }
  }
  laneTimestamps[freeLane] = now + 4000; // Reserve lane for 4s
  return freeLane;
}

export function useDanmaku(
  containerRef: React.RefObject<HTMLDivElement | null>,
) {
  const shoot = useCallback(
    (message: LiveChatMessage) => {
      const container = containerRef.current;
      if (!container) return;

      const el = document.createElement("div");
      el.className = "danmaku-item";
      el.textContent = `${message.authorName}: ${message.message}`;

      const lane = getFreeLane();
      const containerHeight = container.clientHeight;
      const laneHeight = Math.floor(containerHeight / TRACK_COUNT);
      const topOffset = lane * laneHeight + Math.floor(laneHeight / 4);

      const duration = 5000 + Math.random() * 3000;
      const containerWidth = container.clientWidth;

      el.style.top = `${topOffset}px`;
      el.style.left = `${containerWidth}px`;
      el.style.animationDuration = `${duration}ms`;
      // Slight color variation for visual interest
      const hue = Math.floor(Math.random() * 60) + 20; // 20-80deg (orange/yellow range)
      el.style.color = `hsl(${hue}, 100%, 80%)`;

      container.appendChild(el);

      const cleanup = () => {
        if (el.parentNode === container) container.removeChild(el);
      };
      el.addEventListener("animationend", cleanup, { once: true });
      setTimeout(cleanup, duration + 500); // Safety fallback cleanup
    },
    [containerRef],
  );

  return { shoot };
}

// Standalone overlay component for storybook/testing
export default function DanmakuOverlay({ containerRef }: DanmakuOverlayProps) {
  // Overlay is rendered by the parent; this component is a no-op wrapper
  return null;
}
