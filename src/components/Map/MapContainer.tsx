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

// ─── Marker builders ──────────────────────────────────────────────────────────

function buildCameraMarker(camera: ExploreCamera, isOpen: boolean): HTMLElement {
  const meta = CATEGORY_META[camera.category];
  const el = document.createElement("div");
  el.id = `marker-cam-${camera.id}`;
  // Fixed size container — no transforms on the root element so MapLibre can
  // position it correctly without interference.
  el.style.cssText = `
    width: 40px;
    height: 40px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  `;

  el.innerHTML = `
    <div class="cam-icon" style="
      width: 40px; height: 40px; border-radius: 50%;
      background: ${isOpen ? meta.color + "44" : meta.color + "1a"};
      border: 2.5px solid ${meta.color}${isOpen ? "ff" : "aa"};
      display: flex; align-items: center; justify-content: center;
      font-size: 18px; line-height: 1;
      box-shadow: 0 0 ${isOpen ? 20 : 10}px ${meta.color}${isOpen ? "88" : "44"},
                  0 0 ${isOpen ? 40 : 20}px ${meta.color}${isOpen ? "33" : "11"};
      transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
      /* No will-change or transform — avoid interfering with MapLibre positioning */
    ">${meta.emoji}</div>
    <div style="
      position: absolute;
      inset: -8px;
      border-radius: 50%;
      border: 1.5px solid ${meta.color};
      opacity: 0.3;
      pointer-events: none;
      animation: et-ping 2.4s cubic-bezier(0, 0, 0.2, 1) infinite;
    "></div>
  `;

  return el;
}

function buildAnimalMarker(track: AnimalTrack): HTMLElement {
  const meta = ANIMAL_TYPE_META[track.animalType];
  const el = document.createElement("div");
  el.id = `marker-animal-${track.id}`;
  el.style.cssText = `
    width: 36px;
    height: 36px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  `;

  el.innerHTML = `
    <div class="animal-icon" style="
      width: 36px; height: 36px; border-radius: 50%;
      background: ${track.color}22;
      border: 2px solid ${track.color}cc;
      display: flex; align-items: center; justify-content: center;
      font-size: 16px; line-height: 1;
      box-shadow: 0 0 14px ${track.color}55, 0 0 28px ${track.color}22;
      transition: border-color 0.2s ease;
    ">${meta.emoji}</div>
    <div style="
      position: absolute;
      inset: -6px;
      border-radius: 50%;
      border: 1.5px solid ${track.color};
      opacity: 0.25;
      pointer-events: none;
      animation: et-ping 2.8s cubic-bezier(0, 0, 0.2, 1) infinite;
      animation-delay: ${(Math.random() * 1.5).toFixed(2)}s;
    "></div>
  `;

  return el;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MapContainer({
  cameras,
  tracks,
  filter,
  openVideoIds,
  onOpenCamera,
  onSelectAnimal,
}: MapContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Track which sources/layers/markers have been added — keyed by ID.
  // We NEVER fully wipe these; we only update visibility or replace on data change.
  const camMarkersRef = useRef<globalThis.Map<string, maplibregl.Marker>>(
    new globalThis.Map()
  );
  const animalMarkersRef = useRef<globalThis.Map<string, maplibregl.Marker>>(
    new globalThis.Map()
  );
  const trackSourcesRef = useRef<globalThis.Set<string>>(new globalThis.Set());

  // ── One-time map init ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Inject ping keyframe once into document head
    if (!document.getElementById("et-anim")) {
      const s = document.createElement("style");
      s.id = "et-anim";
      s.textContent = `
        @keyframes et-ping {
          0%   { transform: scale(1);   opacity: 0.3; }
          80%  { transform: scale(1.9); opacity: 0; }
          100% { transform: scale(1.9); opacity: 0; }
        }
      `;
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
      camMarkersRef.current.clear();
      animalMarkersRef.current.clear();
      trackSourcesRef.current.clear();
    };
  }, []);

  // ── Track lines: add new ones, toggle visibility for existing ──────────────
  // We use setLayoutProperty('visibility') instead of removing/re-adding layers.
  // This is the key fix for the "markers move on zoom" issue.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;

    tracks.forEach((track) => {
      const srcId = `et-track-src-${track.id}`;
      const glowId = `et-track-glow-${track.id}`;
      const lineId = `et-track-line-${track.id}`;
      const visible = filter.animalTypes.has(track.animalType) ? "visible" : "none";

      if (trackSourcesRef.current.has(srcId)) {
        // Already added — just toggle visibility without touching geometry
        if (map.getLayer(glowId)) map.setLayoutProperty(glowId, "visibility", visible);
        if (map.getLayer(lineId)) map.setLayoutProperty(lineId, "visibility", visible);
        return;
      }

      // First time: add source + layers
      const geojson: GeoJSON.Feature<GeoJSON.LineString> = {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: track.coordinates.map((c) => [c.longitude, c.latitude]),
        },
      };

      try {
        map.addSource(srcId, { type: "geojson", data: geojson });

        map.addLayer({
          id: glowId,
          type: "line",
          source: srcId,
          layout: { visibility: visible },
          paint: {
            "line-color": track.color,
            "line-width": 10,
            "line-opacity": 0.12,
            "line-blur": 6,
          },
        });

        map.addLayer({
          id: lineId,
          type: "line",
          source: srcId,
          layout: { visibility: visible },
          paint: {
            "line-color": track.color,
            "line-width": 2,
            "line-opacity": 0.85,
            "line-dasharray": [3, 1.5],
          },
        });

        trackSourcesRef.current.add(srcId);
      } catch (err) {
        // Layer may already exist from a hot-reload — safe to ignore
        console.warn("[MapContainer] Layer add error (likely HMR):", err);
      }
    });
  }, [tracks, filter.animalTypes, isLoaded]);

  // ── Camera markers: add new, update open-state styling, toggle visibility ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;

    cameras.forEach((cam) => {
      const isOpen = openVideoIds.has(cam.id);
      const shouldShow =
        filter.cameraCategories.has(cam.category) &&
        (!filter.showLiveOnly || cam.isLive);

      if (camMarkersRef.current.has(cam.id)) {
        // Marker exists — update visibility and open-state styling in-place.
        const marker = camMarkersRef.current.get(cam.id)!;
        const el = marker.getElement();

        // Toggle DOM visibility (keeps MapLibre transform intact)
        el.style.display = shouldShow ? "flex" : "none";

        // Update icon styling to reflect open/closed state
        const icon = el.querySelector(".cam-icon") as HTMLElement | null;
        if (icon) {
          const meta = CATEGORY_META[cam.category];
          icon.style.background = isOpen ? meta.color + "44" : meta.color + "1a";
          icon.style.borderColor = isOpen ? meta.color : meta.color + "aa";
          icon.style.boxShadow = isOpen
            ? `0 0 20px ${meta.color}88, 0 0 40px ${meta.color}33`
            : `0 0 10px ${meta.color}44, 0 0 20px ${meta.color}11`;
        }
        return;
      }

      // First time: build marker and add to map
      const el = buildCameraMarker(cam, isOpen);
      el.style.display = shouldShow ? "flex" : "none";

      el.addEventListener("mouseenter", () => {
        const icon = el.querySelector(".cam-icon") as HTMLElement | null;
        if (icon) icon.style.filter = "brightness(1.3)";
      });
      el.addEventListener("mouseleave", () => {
        const icon = el.querySelector(".cam-icon") as HTMLElement | null;
        if (icon) icon.style.filter = "";
      });
      el.addEventListener("click", () => onOpenCamera(cam));

      const marker = new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat(cam.coordinates)
        .addTo(map);

      camMarkersRef.current.set(cam.id, marker);
    });
  }, [cameras, filter.cameraCategories, filter.showLiveOnly, openVideoIds, isLoaded, onOpenCamera]);

  // ── Animal markers: add new, toggle visibility ────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;

    tracks.forEach((track) => {
      if (!track.currentPosition) return;

      const shouldShow = filter.animalTypes.has(track.animalType);

      if (animalMarkersRef.current.has(track.id)) {
        // Already exists — just toggle visibility
        const marker = animalMarkersRef.current.get(track.id)!;
        marker.getElement().style.display = shouldShow ? "flex" : "none";
        return;
      }

      // First time: build marker
      const el = buildAnimalMarker(track);
      el.style.display = shouldShow ? "flex" : "none";

      el.addEventListener("mouseenter", () => {
        const icon = el.querySelector(".animal-icon") as HTMLElement | null;
        if (icon) icon.style.filter = "brightness(1.3)";
      });
      el.addEventListener("mouseleave", () => {
        const icon = el.querySelector(".animal-icon") as HTMLElement | null;
        if (icon) icon.style.filter = "";
      });
      el.addEventListener("click", () => onSelectAnimal({ type: "animal", track }));

      const marker = new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat(track.currentPosition)
        .addTo(map);

      animalMarkersRef.current.set(track.id, marker);
    });
  }, [tracks, filter.animalTypes, isLoaded, onSelectAnimal]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      {!isLoaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[var(--color-surface-950)]">
          <div className="w-10 h-10 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
          <p className="text-sm text-neutral-500">Loading map…</p>
        </div>
      )}
    </div>
  );
}
