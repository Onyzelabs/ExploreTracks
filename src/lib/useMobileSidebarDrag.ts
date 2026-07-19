"use client";

import { useState, useRef, useEffect, useCallback } from "react";

export function useMobileSidebarDrag(defaultHeightVh = 55) {
  const [heightVh, setHeightVh] = useState(defaultHeightVh);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

  // Reset to default when sidebar opens
  const resetHeight = useCallback(() => {
    setHeightVh(defaultHeightVh);
  }, [defaultHeightVh]);

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    setIsDragging(true);
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    startYRef.current = clientY;
    startHeightRef.current = heightVh;
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: TouchEvent | MouseEvent) => {
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      const deltaY = clientY - startYRef.current;
      const deltaVh = (deltaY / window.innerHeight) * 100;
      let newHeight = startHeightRef.current - deltaVh;
      
      if (newHeight < 15) newHeight = 15;
      if (newHeight > 85) newHeight = 85;
      
      setHeightVh(newHeight);
    };

    const handleEnd = () => setIsDragging(false);

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleEnd);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);
    };
  }, [isDragging]);

  return { heightVh, isDragging, handleTouchStart, resetHeight };
}
