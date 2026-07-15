"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl, { Map, Popup } from "maplibre-gl";
import type { ExploreCamera, AnimalTrack, SidebarContent } from "@/lib/types";
import { CAMERA_CATEGORY_COLORS } from "@/lib/exploreorg";

interface MapContainerProps {
  cameras: ExploreCamera[];
  tracks: AnimalTrack[];
  onSelectContent: (content: SidebarContent) => void;
}

// Dark satellite-style basemap from Stadia Maps (no API key required for development)
const BASEMAP_STYLE =
  "https://tiles.stadiamaps.com/styles/alidade_smooth_dark.json";

export default function MapContainer({ cameras, tracks, onSelectContent }: MapContainerProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const initMap = useCallback(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: BASEMAP_STYLE,
      center: [20, 20],
      zoom: 2.2,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right"
    );

    map.on("load", () => {
      setIsLoaded(true);

      // ── Animal Tracks ──────────────────────────────────────────────────
      tracks.forEach((track) => {
        const sourceId = `track-source-${track.id}`;
        const lineLayerId = `track-line-${track.id}`;
        const dotLayerId = `track-dot-${track.id}`;

        const geojsonLine: GeoJSON.Feature<GeoJSON.LineString> = {
          type: "Feature",
          properties: { id: track.id, name: track.individualName, color: track.color },
          geometry: {
            type: "LineString",
            coordinates: track.coordinates.map((c) => [c.longitude, c.latitude]),
          },
        };

        map.addSource(sourceId, { type: "geojson", data: geojsonLine });

        // Glowing track line
        map.addLayer({
          id: `${lineLayerId}-glow`,
          type: "line",
          source: sourceId,
          paint: {
            "line-color": track.color,
            "line-width": 8,
            "line-opacity": 0.2,
            "line-blur": 4,
          },
        });

        map.addLayer({
          id: lineLayerId,
          type: "line",
          source: sourceId,
          paint: {
            "line-color": track.color,
            "line-width": 2.5,
            "line-opacity": 0.9,
            "line-dasharray": [2, 1],
          },
        });

        // Current position dot
        if (track.currentPosition) {
          const dotSource = `dot-source-${track.id}`;
          const geojsonDot: GeoJSON.Feature<GeoJSON.Point> = {
            type: "Feature",
            properties: { id: track.id, name: track.individualName, color: track.color, type: "animal" },
            geometry: { type: "Point", coordinates: track.currentPosition },
          };
          map.addSource(dotSource, { type: "geojson", data: geojsonDot });

          // Outer glow pulse
          map.addLayer({
            id: `${dotLayerId}-glow`,
            type: "circle",
            source: dotSource,
            paint: {
              "circle-radius": 14,
              "circle-color": track.color,
              "circle-opacity": 0.15,
              "circle-blur": 0.5,
            },
          });

          map.addLayer({
            id: dotLayerId,
            type: "circle",
            source: dotSource,
            paint: {
              "circle-radius": 7,
              "circle-color": track.color,
              "circle-stroke-width": 2,
              "circle-stroke-color": "#ffffff",
              "circle-opacity": 1,
            },
          });

          // Click to open animal sidebar
          map.on("click", dotLayerId, (e) => {
            const feature = e.features?.[0];
            if (!feature) return;
            const clicked = tracks.find((t) => t.id === feature.properties?.id);
            if (clicked) onSelectContent({ type: "animal", track: clicked });
          });

          map.on("mouseenter", dotLayerId, () => {
            map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", dotLayerId, () => {
            map.getCanvas().style.cursor = "";
          });
        }
      });

      // ── Camera Markers ─────────────────────────────────────────────────
      cameras.forEach((cam) => {
        const color = CAMERA_CATEGORY_COLORS[cam.category];

        // Custom HTML marker
        const el = document.createElement("div");
        el.id = `camera-marker-${cam.id}`;
        el.style.cssText = `
          width: 36px;
          height: 36px;
          position: relative;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        `;
        el.innerHTML = `
          <div style="
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: ${color}22;
            border: 2px solid ${color};
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            box-shadow: 0 0 16px ${color}66, 0 0 32px ${color}33;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
          " class="camera-icon">
            📷
          </div>
          <div style="
            position: absolute;
            inset: -6px;
            border-radius: 50%;
            border: 2px solid ${color};
            opacity: 0.4;
            animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
          "></div>
        `;

        el.addEventListener("click", () => {
          onSelectContent({ type: "camera", camera: cam });
        });
        el.addEventListener("mouseenter", () => {
          (el.querySelector(".camera-icon") as HTMLElement).style.transform = "scale(1.2)";
          (el.querySelector(".camera-icon") as HTMLElement).style.boxShadow = `0 0 24px ${color}99, 0 0 48px ${color}44`;
        });
        el.addEventListener("mouseleave", () => {
          (el.querySelector(".camera-icon") as HTMLElement).style.transform = "scale(1)";
          (el.querySelector(".camera-icon") as HTMLElement).style.boxShadow = `0 0 16px ${color}66, 0 0 32px ${color}33`;
        });

        new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat(cam.coordinates)
          .addTo(map);
      });
    });

    // Add CSS for ping animation
    const style = document.createElement("style");
    style.textContent = `
      @keyframes ping {
        75%, 100% { transform: scale(1.8); opacity: 0; }
      }
    `;
    document.head.appendChild(style);

    mapRef.current = map;
  }, [cameras, tracks, onSelectContent]);

  useEffect(() => {
    initMap();
    return () => {
      popupRef.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [initMap]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />
      {/* Loading overlay */}
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-surface-900)]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
            <p className="text-sm text-neutral-400">Loading map…</p>
          </div>
        </div>
      )}
    </div>
  );
}
