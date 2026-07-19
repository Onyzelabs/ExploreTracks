"use client";

import { renderToString } from "react-dom/server";
import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl, { Map as MaplibreMap } from "maplibre-gl";
import type {
  ExploreCamera,
  AnimalTrack,
  FilterState,
  SidebarContent,
  OpenVideoPanel,
} from "@/lib/types";
import { CATEGORY_META, ANIMAL_TYPE_META } from "@/lib/types";
import { getTerminator } from "@/lib/terminator";

interface MapContainerProps {
  cameras: ExploreCamera[];
  tracks: AnimalTrack[];
  filter: FilterState;
  openVideos: OpenVideoPanel[];
  activeTrackId: string | null;
  /** Set of track IDs to show simultaneously in comparison mode */
  compareTrackIds?: Set<string>;
  /** When non-null, display only up to this coordinate index on the active track */
  playbackIndex: number | null;
  /** OpenWeatherMap layer type to overlay (null = no overlay) */
  weatherLayer: "clouds_new" | "precipitation_new" | "wind_new" | "terminator" | null;
  mapStyle: string;
  onOpenCamera: (camera: ExploreCamera) => void;
  onSelectAnimal: (content: SidebarContent) => void;
}

// We use Rainviewer for free weather radar (no API key required)
const RAINVIEWER_API = "https://api.rainviewer.com/public/weather-maps.json";

const BASEMAP_STYLE =
  "https://tiles.stadiamaps.com/styles/alidade_smooth_dark.json";

const ESRI_SATELLITE_STYLE = {
  version: 8,
  sources: {
    esri: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "&copy; Esri, Maxar, Earthstar Geographics",
    },
  },
  layers: [
    {
      id: "satellite",
      type: "raster",
      source: "esri",
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

// ─── Marker builders ──────────────────────────────────────────────────────────

function buildCameraMarker(
  camera: ExploreCamera,
  openSlot: number | null,
): HTMLElement {
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
  `;

  el.innerHTML = `
    <div class="cam-icon" style="
      width: 40px; height: 40px; border-radius: 50%;
      background: ${openSlot !== null ? meta.color + "44" : meta.color + "1a"};
      border: 2.5px solid ${meta.color}${openSlot !== null ? "ff" : "aa"};
      display: flex; align-items: center; justify-content: center;
      font-size: 18px; line-height: 1;
      box-shadow: 0 0 ${openSlot !== null ? 20 : 10}px ${meta.color}${openSlot !== null ? "88" : "44"};
      transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
      color: ${openSlot !== null ? "#fff" : meta.color};
      font-weight: 800;
      font-family: var(--font-sans);
    ">${openSlot !== null ? (openSlot + 1).toString() : renderToString(<meta.icon size={18} strokeWidth={2.5} />)}</div>
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
      color: ${track.color};
    ">${renderToString(<meta.icon size={16} strokeWidth={2.5} />)}</div>
  `;

  return el;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MapContainer({
  cameras,
  tracks,
  filter,
  openVideos,
  activeTrackId,
  compareTrackIds,
  playbackIndex,
  weatherLayer,
  mapStyle,
  onOpenCamera,
  onSelectAnimal,
}: MapContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Track which sources/layers/markers have been added — keyed by ID.
  // We NEVER fully wipe these; we only update visibility or replace on data change.
  const camMarkersRef = useRef<globalThis.Map<string, maplibregl.Marker>>(
    new globalThis.Map(),
  );
  const animalMarkersRef = useRef<globalThis.Map<string, maplibregl.Marker>>(
    new globalThis.Map(),
  );
  const trackSourcesRef = useRef<globalThis.Set<string>>(new globalThis.Set());
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const markerPopupRef = useRef<maplibregl.Popup | null>(null);
  // Glowing dot that follows the playback scrubber position
  const playbackMarkerRef = useRef<maplibregl.Marker | null>(null);

  // ── Automatically fly to newly opened cameras ─────────────────────────────
  const prevOpenVideoIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;
    
    for (const v of openVideos) {
      if (!prevOpenVideoIds.current.has(v.camera.id)) {
        map.flyTo({
          center: v.camera.coordinates,
          zoom: Math.max(map.getZoom() ?? 4, 5),
          speed: 1.4,
          essential: true,
        });
        break; // Only fly to the first new one if multiple are opened
      }
    }
    prevOpenVideoIds.current = new Set(openVideos.map((v) => v.camera.id));
  }, [openVideos, isLoaded]);

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
      style:
        mapStyle === "satellite" ? (ESRI_SATELLITE_STYLE as any) : mapStyle,
      center: [20, 15],
      zoom: 2.1,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
      dragRotate: false,
      touchPitch: false,
    });

    // Disable two-finger rotation but KEEP two-finger pinch-to-zoom
    map.touchZoomRotate.disableRotation();

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right",
    );
    map.on("load", () => setIsLoaded(true));

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      if (popupRef.current) popupRef.current.remove();
      popupRef.current = null;
      if (markerPopupRef.current) markerPopupRef.current.remove();
      markerPopupRef.current = null;
      if (playbackMarkerRef.current) playbackMarkerRef.current.remove();
      playbackMarkerRef.current = null;
      camMarkersRef.current.clear();
      animalMarkersRef.current.clear();
      trackSourcesRef.current.clear();
    };
  }, []);

  // ── Track lines: add new ones, toggle visibility for existing ──────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;

    tracks.forEach((track) => {
      const srcId = `et-track-src-${track.id}`;
      const glowId = `et-track-glow-${track.id}`;
      const lineId = `et-track-line-${track.id}`;
      const pointsId = `et-track-points-${track.id}`;
      const search = filter.searchText.toLowerCase();
      const matchesSearch =
        search === "" ||
        track.individualName.toLowerCase().includes(search) ||
        track.commonName.toLowerCase().includes(search) ||
        track.species.toLowerCase().includes(search);

      const isVisible =
        filter.animalTypes.has(track.animalType) &&
        matchesSearch &&
        activeTrackId === track.id;

      if (trackSourcesRef.current.has(srcId)) {
        const visibility = isVisible ? "visible" : "none";
        if (map.getLayer(glowId))
          map.setLayoutProperty(glowId, "visibility", visibility);
        if (map.getLayer(lineId))
          map.setLayoutProperty(lineId, "visibility", visibility);
        if (map.getLayer(pointsId))
          map.setLayoutProperty(pointsId, "visibility", visibility);
        return;
      }

      // First time: add source + layers
      const features: GeoJSON.Feature[] = [
        {
          type: "Feature",
          properties: { trackId: track.id, type: "line" },
          geometry: {
            type: "LineString",
            coordinates: track.coordinates.map((c) => [
              c.longitude,
              c.latitude,
            ]),
          },
        },
      ];

      track.coordinates.forEach((c, index) => {
        const isLatest = index === track.coordinates.length - 1;
        features.push({
          type: "Feature",
          properties: {
            trackId: track.id,
            type: "point",
            animalName: track.commonName || track.individualName,
            timestamp: c.timestamp,
            speed: c.speed ?? null,
            color: track.color,
            isLatest,
          },
          geometry: { type: "Point", coordinates: [c.longitude, c.latitude] },
        });
      });

      const geojson: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features,
      };

      try {
        map.addSource(srcId, { type: "geojson", data: geojson });

        map.addLayer({
          id: glowId,
          type: "line",
          source: srcId,
          filter: ["==", "type", "line"],
          layout: { visibility: isVisible ? "visible" : "none" },
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
          filter: ["==", "type", "line"],
          layout: { visibility: isVisible ? "visible" : "none" },
          paint: {
            "line-color": track.color,
            "line-width": 2,
            "line-opacity": 0.85,
            "line-dasharray": [3, 1.5],
          },
        });

        map.addLayer({
          id: pointsId,
          type: "circle",
          source: srcId,
          filter: ["==", "type", "point"],
          layout: { visibility: "visible" },
          paint: {
            "circle-radius": 5,
            "circle-color": track.color,
            "circle-stroke-width": 1.5,
            "circle-stroke-color": "#ffffff",
            "circle-opacity": isVisible ? 1 : 0,
            "circle-stroke-opacity": isVisible ? 1 : 0,
          },
        });

        // Add interactive hover behavior for points
        map.on("mouseenter", pointsId, (e) => {
          if (e.features && e.features.length > 0) {
            const props = e.features[0].properties;
            if (!props || props.isLatest) return;

            map.getCanvas().style.cursor = "pointer";

            const timeStr = new Date(props.timestamp).toLocaleString();
            const speedStr =
              props.speed != null ? `<br>Speed: ${props.speed} m/s` : "";

            if (!popupRef.current) {
              popupRef.current = new maplibregl.Popup({
                closeButton: false,
                closeOnClick: false,
                offset: 10,
                className: "et-popup",
              });
            }

            popupRef.current
              .setLngLat((e.features[0].geometry as any).coordinates)
              .setHTML(
                `
                <div style="color: #fff; background: #1f2937; padding: 10px 16px; border-radius: 8px; border: 1px solid ${props.color}66; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.5); font-family: Inter, sans-serif; font-size: 14px;">
                  <strong style="color: ${props.color}; font-size: 16px;">${props.animalName}</strong><br>
                  <span style="opacity: 0.8; font-size: 14px; margin-top: 4px; display: inline-block;">${timeStr}</span>${speedStr}
                </div>
              `,
              )
              .addTo(map);

            // Fix the ugly default popup background of Maplibre
            const tip = popupRef.current
              .getElement()
              ?.querySelector(".maplibregl-popup-content") as HTMLElement;
            if (tip) {
              tip.style.background = "transparent";
              tip.style.padding = "0";
              tip.style.boxShadow = "none";
            }
          }
        });

        map.on("mouseleave", pointsId, () => {
          map.getCanvas().style.cursor = "";
          if (popupRef.current) {
            popupRef.current.remove();
          }
        });

        const handleRouteClick = (e: any) => {
          if (!e.features || e.features.length === 0) return;
          const props = e.features[0].properties;
          if (!props || !props.trackId) return;

          const clickedTrack = tracks.find((t) => t.id === props.trackId);
          if (clickedTrack) {
            onSelectAnimal({ type: "animal", track: clickedTrack });

            // Zoom to track bounds
            const bounds = new maplibregl.LngLatBounds();
            clickedTrack.coordinates.forEach((c) => {
              bounds.extend([c.longitude, c.latitude]);
            });

            if (!bounds.isEmpty()) {
              map.fitBounds(bounds, {
                padding: { top: 100, bottom: 100, left: 100, right: 450 },
                duration: 1500,
                essential: true,
                maxZoom: 7,
              });
            }
          }
        };

        map.on("click", lineId, handleRouteClick);
        map.on("click", pointsId, handleRouteClick);

        // Add hover cursor for the line itself
        map.on(
          "mouseenter",
          lineId,
          () => (map.getCanvas().style.cursor = "pointer"),
        );
        map.on("mouseleave", lineId, () => (map.getCanvas().style.cursor = ""));

        trackSourcesRef.current.add(srcId);
      } catch (err) {
        // Layer may already exist from a hot-reload — safe to ignore
        console.warn("[MapContainer] Layer add error (likely HMR):", err);
      }
    });
  }, [tracks, filter.animalTypes, filter.searchText, activeTrackId, isLoaded]);

  // ── Weather overlay: toggle Rainviewer radar tile layer ─────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;

    const SRC = "weather-src";
    const LYR = "weather-lyr";

    const removeLayerAndSource = () => {
      if (map.getLayer(LYR)) map.removeLayer(LYR);
      if (map.getSource(SRC)) map.removeSource(SRC);
    };

    if (weatherLayer !== "precipitation_new") {
      removeLayerAndSource();
      return;
    }

    // Fetch latest timestamp from Rainviewer
    let active = true;
    fetch(RAINVIEWER_API)
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        removeLayerAndSource();
        
        // Use the latest past radar frame
        const past = data.radar?.past || [];
        if (past.length === 0) return;
        const latest = past[past.length - 1];
        
        // e.g. https://tilecache.rainviewer.com/v2/radar/1715694000/256/{z}/{x}/{y}/2/1_1.png
        // (color scheme 2, smooth 1, snow 1)
        const tileUrl = `${data.host}${latest.path}/256/{z}/{x}/{y}/2/1_1.png`;

        map.addSource(SRC, {
          type: "raster",
          tiles: [tileUrl],
          tileSize: 256,
          attribution: "Weather © RainViewer",
        });
        map.addLayer({
          id: LYR,
          type: "raster",
          source: SRC,
          paint: { "raster-opacity": 0.6 },
        });
      })
      .catch((err) => console.warn("[MapContainer] Rainviewer error:", err));

    return () => { active = false; };
  }, [weatherLayer, isLoaded]);

  // ── Sunlight Terminator Layer ────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;

    const SRC = "terminator-src";
    const LYR = "terminator-lyr";

    if (weatherLayer !== "terminator") {
      if (map.getLayer(LYR)) map.removeLayer(LYR);
      if (map.getSource(SRC)) map.removeSource(SRC);
      return;
    }

    let currentTime = new Date();
    if (activeTrackId && playbackIndex !== null) {
      const activeTrack = tracks.find((t) => t.id === activeTrackId);
      if (activeTrack && activeTrack.coordinates[playbackIndex]) {
        currentTime = new Date(activeTrack.coordinates[playbackIndex].timestamp);
      }
    }

    const geojson = getTerminator(currentTime);

    if (map.getSource(SRC)) {
      (map.getSource(SRC) as maplibregl.GeoJSONSource).setData(geojson as any);
    } else {
      map.addSource(SRC, {
        type: "geojson",
        data: geojson as any,
      });
      map.addLayer(
        {
          id: LYR,
          type: "fill",
          source: SRC,
          paint: {
            "fill-color": "#000000",
            "fill-opacity": 0.45,
          },
        },
        // Insert below paths/points if possible
        map.getLayer("track-line") ? "track-line" : undefined
      );
    }
  }, [weatherLayer, isLoaded, activeTrackId, playbackIndex, tracks]);

  // ── Compare mode: make additional tracks visible simultaneously ───────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;

    tracks.forEach((track) => {
      const glowId = `et-track-glow-${track.id}`;
      const lineId = `et-track-line-${track.id}`;
      const pointsId = `et-track-points-${track.id}`;

      if (!map.getLayer(lineId)) return;

      const isActive = track.id === activeTrackId;
      const isCompared = compareTrackIds?.has(track.id) ?? false;
      const visibility = isActive || isCompared ? "visible" : "none";

      if (map.getLayer(glowId)) map.setLayoutProperty(glowId, "visibility", visibility);
      if (map.getLayer(lineId)) map.setLayoutProperty(lineId, "visibility", visibility);
      if (map.getLayer(pointsId)) {
        map.setPaintProperty(pointsId, "circle-opacity", visibility === "visible" ? 1 : 0);
        map.setPaintProperty(pointsId, "circle-stroke-opacity", visibility === "visible" ? 1 : 0);
      }
    });
  }, [compareTrackIds, activeTrackId, tracks, isLoaded]);

  // ── Playback: update track source data + move glowing position marker ────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded || !activeTrackId) {
      // Remove playback marker when no track is active
      if (playbackMarkerRef.current) {
        playbackMarkerRef.current.remove();
        playbackMarkerRef.current = null;
      }
      return;
    }

    const track = tracks.find((t) => t.id === activeTrackId);
    if (!track) return;

    const srcId = `et-track-src-${track.id}`;
    if (!map.getSource(srcId)) return;

    // Determine how many points to show
    const sliceEnd = playbackIndex !== null ? playbackIndex + 1 : track.coordinates.length;
    const slicedCoords = track.coordinates.slice(0, sliceEnd);

    // Rebuild GeoJSON with trimmed coordinates
    const features: GeoJSON.Feature[] = [
      {
        type: "Feature",
        properties: { trackId: track.id, type: "line" },
        geometry: {
          type: "LineString",
          coordinates: slicedCoords.map((c) => [c.longitude, c.latitude]),
        },
      },
    ];

    slicedCoords.forEach((c, index) => {
      const isLatest = index === slicedCoords.length - 1;
      features.push({
        type: "Feature",
        properties: {
          trackId: track.id,
          type: "point",
          animalName: track.commonName || track.individualName,
          timestamp: c.timestamp,
          speed: c.speed ?? null,
          color: track.color,
          isLatest,
        },
        geometry: { type: "Point", coordinates: [c.longitude, c.latitude] },
      });
    });

    (map.getSource(srcId) as maplibregl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features,
    });

    // Move/create the glowing position marker at the current scrub point
    const currentCoord = slicedCoords[slicedCoords.length - 1];
    if (!currentCoord) return;

    const lngLat: [number, number] = [currentCoord.longitude, currentCoord.latitude];

    if (playbackIndex !== null) {
      if (!playbackMarkerRef.current) {
        const dot = document.createElement("div");
        dot.style.cssText = `
          width: 16px; height: 16px; border-radius: 50%;
          background: ${track.color};
          border: 2.5px solid white;
          box-shadow: 0 0 12px ${track.color}, 0 0 24px ${track.color}88;
          pointer-events: none;
        `;
        playbackMarkerRef.current = new maplibregl.Marker({ element: dot, anchor: "center" })
          .setLngLat(lngLat)
          .addTo(map);
      } else {
        playbackMarkerRef.current.setLngLat(lngLat);
      }

      // Gently pan map to keep the playback position visible
      if (!map.getBounds().contains(lngLat)) {
        map.easeTo({ center: lngLat, duration: 600 });
      }
    } else {
      // Reset: remove the position marker
      if (playbackMarkerRef.current) {
        playbackMarkerRef.current.remove();
        playbackMarkerRef.current = null;
      }
    }
  }, [playbackIndex, activeTrackId, tracks, isLoaded]);

  // ── Camera markers: add new, update open-state styling, toggle visibility ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;

    cameras.forEach((cam) => {
      const search = filter.searchText.toLowerCase();
      const matchesSearch =
        search === "" ||
        cam.name.toLowerCase().includes(search) ||
        cam.location.toLowerCase().includes(search);

      const shouldShow =
        (filter.cameraCategories.size === 0 || filter.cameraCategories.has(cam.category)) && matchesSearch;

      const openVideo = openVideos.find((v) => v.camera.id === cam.id);
      const openSlot = openVideo ? openVideo.slot : null;

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
          icon.style.background = openSlot !== null
            ? meta.color + "44"
            : meta.color + "1a";
          icon.style.borderColor = openSlot !== null ? meta.color : meta.color + "aa";
          icon.style.boxShadow = openSlot !== null
            ? `0 0 20px ${meta.color}88, 0 0 40px ${meta.color}33`
            : `0 0 10px ${meta.color}44, 0 0 20px ${meta.color}11`;
          icon.style.color = openSlot !== null ? "#fff" : meta.color;
          icon.style.fontWeight = "800";
          icon.style.fontFamily = "var(--font-sans)";
          
          if (openSlot !== null) {
            icon.innerText = (openSlot + 1).toString();
          } else {
            icon.innerHTML = renderToString(<meta.icon size={18} strokeWidth={2.5} />);
          }
        }
        return;
      }

      // First time: build marker and add to map
      const el = buildCameraMarker(cam, openSlot);
      el.style.display = shouldShow ? "flex" : "none";

      let hideTimeout: NodeJS.Timeout;

      el.addEventListener("mouseenter", () => {
        if (hideTimeout) clearTimeout(hideTimeout);
        const icon = el.querySelector(".cam-icon") as HTMLElement | null;
        if (icon) icon.style.filter = "brightness(1.3)";

        if (!markerPopupRef.current) {
          markerPopupRef.current = new maplibregl.Popup({
            closeButton: false,
            closeOnClick: false,
            offset: 15,
          });
        }

        const div = document.createElement("div");
        // Build Live badge HTML conditionally (avoids nested template literal)
        const liveBadgeHtml = cam.isLive
          ? '<span style="display:flex;align-items:center;gap:4px;font-size:10px;font-weight:700;color:#f87171;white-space:nowrap;">'
            + '<span style="width:6px;height:6px;border-radius:50%;background:#ef4444;display:inline-block;animation:et-ping 2.4s cubic-bezier(0,0,0.2,1) infinite;"></span>'
            + "LIVE</span>"
          : "";
        // Build the popup content using string concatenation to avoid nested-backtick issues
        div.innerHTML =
          '<div style="background: var(--color-surface-900); padding: 12px; border-radius: 10px; border: 1px solid var(--glass-border); width: 240px; box-shadow: 0 8px 24px rgba(0,0,0,0.6);">'
          + '<div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">'
          + '<div style="font-family: var(--font-sans); font-size: 13px; font-weight: 600; color: white; line-height:1.3; flex:1; margin-right:8px;">'
          + cam.name
          + "</div>"
          + liveBadgeHtml
          + "</div>"
          + '<div style="position: relative; width: 100%; border-radius: 6px; overflow: hidden; background: #000; aspect-ratio: 16/9;">'
          + '<img'
          + ' src="' + cam.thumbnail + '"'
          + " onerror=\"this.onerror=null; this.src='https://img.youtube.com/vi/" + cam.youtubeVideoId + "/hqdefault.jpg';\""
          + ' style="width: 100%; height: 100%; display: block; object-fit: cover;"'
          + ' alt="Live Preview"'
          + " />"
          + "</div>"
          + '<div style="font-family: var(--font-sans); font-size: 11px; color: #71717a; margin-top:8px; display:flex; align-items:center; gap:4px;">'
          + '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>'
          + "<span>"
          + cam.location
          + "</span>"
          + "</div>"
          + "</div>";

        div.addEventListener("mouseenter", () => {
          if (hideTimeout) clearTimeout(hideTimeout);
        });
        div.addEventListener("mouseleave", () => {
          if (markerPopupRef.current) markerPopupRef.current.remove();
        });

        markerPopupRef.current
          .setDOMContent(div)
          .setLngLat(cam.coordinates)
          .addTo(map);

        const tip = markerPopupRef.current
          .getElement()
          ?.querySelector(".maplibregl-popup-content") as HTMLElement;
        if (tip) {
          tip.style.background = "transparent";
          tip.style.padding = "0";
          tip.style.boxShadow = "none";
        }
      });
      el.addEventListener("mouseleave", () => {
        const icon = el.querySelector(".cam-icon") as HTMLElement | null;
        if (icon) icon.style.filter = "";
        hideTimeout = setTimeout(() => {
          if (markerPopupRef.current) markerPopupRef.current.remove();
        }, 150);
      });
      el.addEventListener("click", () => {
        onOpenCamera(cam);
        // Fly to camera location on click; preserve current zoom if already zoomed in past level 5
        map.flyTo({
          center: cam.coordinates,
          zoom: Math.max(mapRef.current?.getZoom() ?? 4, 5),
          speed: 1.4,
          essential: true,
        });
      });

      const marker = new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat(cam.coordinates)
        .addTo(map);

      camMarkersRef.current.set(cam.id, marker);
    });
  }, [
    cameras,
    filter.cameraCategories,
    filter.searchText,
    openVideos,
    isLoaded,
    onOpenCamera,
  ]);

  // ── Animal markers: add new, toggle visibility ────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;

    tracks.forEach((track) => {
      if (!track.currentPosition) return;

      const search = filter.searchText.toLowerCase();
      const matchesSearch =
        search === "" ||
        track.individualName.toLowerCase().includes(search) ||
        track.commonName.toLowerCase().includes(search) ||
        track.species.toLowerCase().includes(search);

      const shouldShow =
        filter.animalTypes.has(track.animalType) && matchesSearch;

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

        if (!markerPopupRef.current) {
          markerPopupRef.current = new maplibregl.Popup({
            closeButton: false,
            closeOnClick: false,
            offset: 15,
          });
        }
        markerPopupRef.current
          .setLngLat(track.currentPosition!)
          .setHTML(
            `
            <div style="background: var(--color-surface-900); padding: 12px; border-radius: 8px; border: 1px solid var(--glass-border); width: 180px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); display: flex; flex-direction: column; align-items: center; text-align: center;">
              <div style="font-family: var(--font-sans); font-size: 16px; font-weight: 600; color: white; margin-bottom: 4px;">${track.individualName}</div>
              <div style="font-family: var(--font-sans); font-size: 14px; color: #a1a1aa; margin-bottom: 8px;">${track.species}</div>
              <img id="hover-wiki-img-${track.id}" style="width: 100%; border-radius: 6px; display: none; object-fit: cover; height: 110px;" />
            </div>
          `,
          )
          .addTo(map);

        const tip = markerPopupRef.current
          .getElement()
          ?.querySelector(".maplibregl-popup-content") as HTMLElement;
        if (tip) {
          tip.style.background = "transparent";
          tip.style.padding = "0";
          tip.style.boxShadow = "none";
        }

        if (track.species && track.species !== "Unknown") {
          fetch(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(track.species)}`,
          )
            .then((r) => r.json())
            .then((data) => {
              const img = document.getElementById(
                `hover-wiki-img-${track.id}`,
              ) as HTMLImageElement;
              if (img && data.thumbnail?.source) {
                img.src = data.thumbnail.source;
                img.style.display = "block";
              }
            })
            .catch(() => {});
        }
      });
      el.addEventListener("mouseleave", () => {
        const icon = el.querySelector(".animal-icon") as HTMLElement | null;
        if (icon) icon.style.filter = "";
        if (markerPopupRef.current) markerPopupRef.current.remove();
      });
      el.addEventListener("click", () => {
        onSelectAnimal({ type: "animal", track });
        map.flyTo({
          center: track.currentPosition,
          zoom: 6,
          speed: 1.5,
          essential: true,
        });
      });

      const marker = new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat(track.currentPosition)
        .addTo(map);

      animalMarkersRef.current.set(track.id, marker);
    });
  }, [tracks, filter.animalTypes, filter.searchText, isLoaded, onSelectAnimal]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      {!isLoaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[var(--color-surface-950)]">
          <div className="w-10 h-10 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
          <p className="text-base text-neutral-500">Loading map…</p>
        </div>
      )}
    </div>
  );
}
