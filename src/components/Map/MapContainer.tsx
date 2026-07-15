"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl, { Map as MaplibreMap } from "maplibre-gl";
import type { ExploreCamera, AnimalTrack, FilterState, SidebarContent } from "@/lib/types";
import { CATEGORY_META, ANIMAL_TYPE_META } from "@/lib/types";

interface MapContainerProps {
  cameras: ExploreCamera[];
  tracks: AnimalTrack[];
  filter: FilterState;
  openVideoIds: Set<string>;
  onOpenCamera: (camera: ExploreCamera) => void;
  onSelectAnimal: (content: SidebarContent) => void;
}

const BASEMAP_STYLE = "https://tiles.stadiamaps.com/styles/alidade_smooth_dark.json";

/** Build a glowing emoji marker element for a camera */
function buildCameraMarker(camera: ExploreCamera, isOpen: boolean): HTMLElement {
  const meta = CATEGORY_META[camera.category];
  const el = document.createElement("div");
  el.id = `marker-cam-${camera.id}`;
  el.style.cssText = "position:relative;width:40px;height:40px;cursor:pointer;display:flex;align-items:center;justify-content:center;";

  el.innerHTML = `
    <div class="cam-icon" style="
      width:40px;height:40px;border-radius:50%;
      background:${isOpen ? meta.color + "44" : meta.color + "1a"};
      border:2px solid ${meta.color}${isOpen ? "ff" : "99"};
      display:flex;align-items:center;justify-content:center;
      font-size:18px;line-height:1;
      box-shadow:0 0 ${isOpen ? "20px" : "12px"} ${meta.color}${isOpen ? "88" : "44"},0 0 ${isOpen ? "40px" : "20px"} ${meta.color}${isOpen ? "44" : "22"};
      transition:all 0.2s ease;
      will-change:transform;
    ">${meta.emoji}</div>
    <div style="
      position:absolute;inset:-6px;border-radius:50%;
      border:2px solid ${meta.color};opacity:0.35;
      animation:ping-slow 2.2s cubic-bezier(0,0,0.2,1) infinite;
    "></div>
  `;

  return el;
}

/** Build a glowing emoji marker element for an animal's current position */
function buildAnimalMarker(track: AnimalTrack): HTMLElement {
  const meta = ANIMAL_TYPE_META[track.animalType];
  const el = document.createElement("div");
  el.id = `marker-animal-${track.id}`;
  el.style.cssText = "position:relative;width:36px;height:36px;cursor:pointer;display:flex;align-items:center;justify-content:center;";

  el.innerHTML = `
    <div class="animal-icon" style="
      width:36px;height:36px;border-radius:50%;
      background:${meta.color}22;
      border:2px solid ${meta.color}bb;
      display:flex;align-items:center;justify-content:center;
      font-size:16px;line-height:1;
      box-shadow:0 0 14px ${meta.color}55,0 0 28px ${meta.color}22;
      transition:all 0.2s ease;
    ">${meta.emoji}</div>
    <div style="
      position:absolute;inset:-5px;border-radius:50%;
      border:1.5px solid ${meta.color};opacity:0.3;
      animation:ping-slow 2.8s cubic-bezier(0,0,0.2,1) infinite;
      animation-delay:${Math.random() * 1.5}s;
    "></div>
  `;

  return el;
}

export default function MapContainer({
  cameras, tracks, filter, openVideoIds, onOpenCamera, onSelectAnimal,
}: MapContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const markersRef = useRef<globalThis.Map<string, maplibregl.Marker>>(new globalThis.Map());
  const [isLoaded, setIsLoaded] = useState(false);

  // ── Map init (runs once) ────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Inject ping animation CSS once
    if (!document.getElementById("map-anim-style")) {
      const s = document.createElement("style");
      s.id = "map-anim-style";
      s.textContent = "@keyframes ping-slow{75%,100%{transform:scale(1.9);opacity:0;}}";
      document.head.appendChild(s);
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAP_STYLE,
      center: [20, 15],
      zoom: 2.1,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    map.on("load", () => setIsLoaded(true));

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ── Track lines (re-runs when tracks or filter change) ────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;

    // Remove existing track layers/sources
    map.getStyle().layers?.forEach((l) => {
      if (l.id.startsWith("track-")) map.removeLayer(l.id);
    });
    Object.keys(map.getStyle().sources ?? {}).forEach((s) => {
      if (s.startsWith("track-src-")) map.removeSource(s);
    });

    tracks.forEach((track) => {
      if (!filter.animalTypes.has(track.animalType)) return;

      const srcId = `track-src-${track.id}`;
      const geojson: GeoJSON.Feature<GeoJSON.LineString> = {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: track.coordinates.map((c) => [c.longitude, c.latitude]),
        },
      };

      if (!map.getSource(srcId)) {
        map.addSource(srcId, { type: "geojson", data: geojson });
      }

      // Outer glow
      if (!map.getLayer(`track-glow-${track.id}`)) {
        map.addLayer({
          id: `track-glow-${track.id}`,
          type: "line",
          source: srcId,
          paint: { "line-color": track.color, "line-width": 10, "line-opacity": 0.12, "line-blur": 6 },
        });
      }

      // Core line
      if (!map.getLayer(`track-line-${track.id}`)) {
        map.addLayer({
          id: `track-line-${track.id}`,
          type: "line",
          source: srcId,
          paint: { "line-color": track.color, "line-width": 2, "line-opacity": 0.85, "line-dasharray": [3, 1.5] },
        });
      }
    });
  }, [tracks, filter, isLoaded]);

  // ── Camera markers (re-runs when cameras, filter, or openVideoIds change) ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;

    // Remove stale camera markers
    markersRef.current.forEach((marker, id) => {
      if (id.startsWith("cam-")) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    cameras.forEach((cam) => {
      if (!filter.cameraCategories.has(cam.category)) return;
      if (filter.showLiveOnly && !cam.isLive) return;

      const el = buildCameraMarker(cam, openVideoIds.has(cam.id));

      el.addEventListener("mouseenter", () => {
        const icon = el.querySelector(".cam-icon") as HTMLElement;
        if (icon) { icon.style.transform = "scale(1.2)"; }
      });
      el.addEventListener("mouseleave", () => {
        const icon = el.querySelector(".cam-icon") as HTMLElement;
        if (icon) { icon.style.transform = "scale(1)"; }
      });
      el.addEventListener("click", () => onOpenCamera(cam));

      const marker = new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat(cam.coordinates)
        .addTo(map);

      markersRef.current.set(`cam-${cam.id}`, marker);
    });
  }, [cameras, filter, openVideoIds, isLoaded, onOpenCamera]);

  // ── Animal markers (re-runs when tracks or filter change) ────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;

    // Remove stale animal markers
    markersRef.current.forEach((marker, id) => {
      if (id.startsWith("animal-")) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    tracks.forEach((track) => {
      if (!filter.animalTypes.has(track.animalType)) return;
      if (!track.currentPosition) return;

      const el = buildAnimalMarker(track);

      el.addEventListener("mouseenter", () => {
        const icon = el.querySelector(".animal-icon") as HTMLElement;
        if (icon) { icon.style.transform = "scale(1.2)"; }
      });
      el.addEventListener("mouseleave", () => {
        const icon = el.querySelector(".animal-icon") as HTMLElement;
        if (icon) { icon.style.transform = "scale(1)"; }
      });
      el.addEventListener("click", () => onSelectAnimal({ type: "animal", track }));

      const marker = new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat(track.currentPosition)
        .addTo(map);

      markersRef.current.set(`animal-${track.id}`, marker);
    });
  }, [tracks, filter, isLoaded, onSelectAnimal]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      {!isLoaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[var(--color-surface-950)]">
          <div className="w-10 h-10 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
          <p className="text-sm text-neutral-500" style={{ fontFamily: "var(--font-body)" }}>
            Loading map…
          </p>
        </div>
      )}
    </div>
  );
}
