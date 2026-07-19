"use client";
import { useState, useEffect } from "react";

const cache = new Map<string, string | null>();

export function useWikipediaImage(species: string) {
  const [imgUrl, setImgUrl] = useState<string | null>(cache.get(species) || null);

  useEffect(() => {
    if (cache.has(species)) {
      setImgUrl(cache.get(species)!);
      return;
    }

    let isMounted = true;
    const fetchImg = async () => {
      try {
        const query = encodeURIComponent(species.replace(/\s+/g, "_"));
        const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${query}`);
        if (!res.ok) {
          if (isMounted) {
            cache.set(species, null);
            setImgUrl(null);
          }
          return;
        }
        const data = await res.json();
        const url = data.thumbnail?.source || data.originalimage?.source || null;
        cache.set(species, url);
        if (isMounted) setImgUrl(url);
      } catch {
        cache.set(species, null);
        if (isMounted) setImgUrl(null);
      }
    };

    fetchImg();

    return () => {
      isMounted = false;
    };
  }, [species]);

  return imgUrl;
}
