"use client";
import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "explore-tracks-favorites";

export function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/exhaustive-deps
      if (raw) setFavorites(new Set(JSON.parse(raw)));
    } catch {}
  }, []);

  const toggle = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...next])); } catch {}
      return next;
    });
  }, []);

  const isFavorite = useCallback((id: string) => favorites.has(id), [favorites]);

  return { favorites, toggle, isFavorite };
}
