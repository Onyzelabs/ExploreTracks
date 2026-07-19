"use client";

import { useEffect, useState } from "react";

interface ResizableMobileSidebarProps {
  id: string;
  heightVh: number;
  isDragging: boolean;
  onTouchStart: (e: React.TouchEvent | React.MouseEvent) => void;
  children: React.ReactNode;
}

export default function ResizableMobileSidebar({
  id,
  heightVh,
  isDragging,
  onTouchStart,
  children,
}: ResizableMobileSidebarProps) {
  // Only apply dynamic height on mobile
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    setIsMobile(window.innerWidth <= 640);
    const handler = () => setIsMobile(window.innerWidth <= 640);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  return (
    <aside
      id={id}
      className={`absolute sm:relative bottom-0 sm:bottom-auto right-0 flex-shrink-0 w-full sm:w-[340px] sm:h-full z-30 sm:z-10 anim-slide-up sm:anim-slide-right overflow-hidden shadow-[0_-8px_30px_rgba(0,0,0,0.6)] sm:shadow-none bg-[var(--color-surface-900)] rounded-t-2xl sm:rounded-none flex flex-col ${
        isDragging ? "transition-none" : "transition-[height] duration-200"
      }`}
      style={{
        height: isMobile ? `${heightVh}vh` : undefined,
      }}
    >
      {/* Drag Handle (Mobile Only) */}
      <div
        className="w-full h-6 flex sm:hidden items-center justify-center cursor-ns-resize flex-shrink-0 bg-[var(--color-surface-800)] hover:bg-[var(--color-surface-800)]/80 touch-none"
        onMouseDown={onTouchStart}
        onTouchStart={onTouchStart}
      >
        <div className="w-10 h-1.5 rounded-full bg-neutral-600" />
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 flex flex-col">
        {children}
      </div>
    </aside>
  );
}
