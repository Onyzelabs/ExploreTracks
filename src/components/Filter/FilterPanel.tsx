"use client";

import { useState, useCallback } from "react";
import type { FilterState, CameraCategory, AnimalType } from "@/lib/types";
import { CATEGORY_META, ANIMAL_TYPE_META } from "@/lib/types";

interface FilterPanelProps {
  filter: FilterState;
  onChange: (next: FilterState) => void;
}

export default function FilterPanel({ filter, onChange }: FilterPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleCamera = useCallback(
    (cat: CameraCategory) => {
      const next = new Set(filter.cameraCategories);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      onChange({ ...filter, cameraCategories: next });
    },
    [filter, onChange],
  );

  const toggleAnimal = useCallback(
    (type: AnimalType) => {
      const next = new Set(filter.animalTypes);
      next.has(type) ? next.delete(type) : next.add(type);
      onChange({ ...filter, animalTypes: next });
    },
    [filter, onChange],
  );

  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ ...filter, searchText: e.target.value });
    },
    [filter, onChange],
  );

  const resetAll = useCallback(() => {
    onChange({
      cameraCategories: new Set(Object.keys(CATEGORY_META) as CameraCategory[]),
      animalTypes: new Set(Object.keys(ANIMAL_TYPE_META) as AnimalType[]),
      searchText: "",
    });
  }, [onChange]);

  const clearAll = useCallback(() => {
    onChange({
      cameraCategories: new Set(),
      animalTypes: new Set(),
      searchText: "",
    });
  }, [onChange]);

  const activeCount =
    Object.keys(CATEGORY_META).length -
    filter.cameraCategories.size +
    (Object.keys(ANIMAL_TYPE_META).length - filter.animalTypes.size) +
    (filter.searchText.trim() !== "" ? 1 : 0);

  return (
    <div className="relative" id="filter-panel-container">
      {/* Trigger button */}
      <button
        id="filter-toggle-btn"
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg glass-card-sm text-sm font-medium text-neutral-300 hover:text-white transition-colors"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        Filter
        {activeCount > 0 && (
          <span className="w-4 h-4 rounded-full bg-orange-500 text-white text-[10px] flex items-center justify-center font-bold">
            {activeCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div
          className="absolute top-full left-0 mt-2 w-[calc(100vw-2rem)] max-w-xs sm:w-72 glass-card p-4 z-50 anim-slide-up shadow-2xl"
          id="filter-dropdown"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <span
              className="text-sm font-semibold text-neutral-400 uppercase tracking-wider"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              Data Sources
            </span>
            <div className="flex gap-3">
              <button
                onClick={clearAll}
                className="text-xs text-neutral-400 hover:text-white transition-colors"
              >
                Clear all
              </button>
              <button
                id="filter-reset-btn"
                onClick={resetAll}
                className="text-xs text-orange-400 hover:text-orange-300 transition-colors"
              >
                Select all
              </button>
            </div>
          </div>

          {/* Search Input */}
          <div className="py-2 border-b border-white/5 mb-3">
            <input
              type="text"
              placeholder="Search animals or cameras..."
              value={filter.searchText}
              onChange={handleSearch}
              className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
            />
          </div>

          {/* Camera categories */}
          <p
            className="text-sm text-orange-400 uppercase tracking-wider mb-2 font-semibold"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Explore.org Live Cameras (Video)
          </p>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {(
              Object.entries(CATEGORY_META) as [
                CameraCategory,
                (typeof CATEGORY_META)[CameraCategory],
              ][]
            ).map(([cat, meta]) => {
              const active = filter.cameraCategories.has(cat);
              return (
                <button
                  key={cat}
                  id={`filter-cam-${cat}`}
                  onClick={() => toggleCamera(cat)}
                  className="filter-chip"
                  style={{
                    background: active
                      ? `${meta.color}22`
                      : "rgba(255,255,255,0.04)",
                    borderColor: active ? `${meta.color}55` : "transparent",
                    color: active ? meta.color : "#71717a",
                  }}
                >
                  <span>{meta.emoji}</span>
                  <span>{meta.label}</span>
                </button>
              );
            })}
          </div>

          {/* Animal track types */}
          <p
            className="text-sm text-cyan-400 uppercase tracking-wider mb-2 font-semibold mt-4"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Movebank Tracks (Telemetry, No Video)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(
              Object.entries(ANIMAL_TYPE_META) as [
                AnimalType,
                (typeof ANIMAL_TYPE_META)[AnimalType],
              ][]
            ).map(([type, meta]) => {
              const active = filter.animalTypes.has(type);
              return (
                <button
                  key={type}
                  id={`filter-animal-${type}`}
                  onClick={() => toggleAnimal(type)}
                  className="filter-chip"
                  style={{
                    background: active
                      ? `${meta.color}22`
                      : "rgba(255,255,255,0.04)",
                    borderColor: active ? `${meta.color}55` : "transparent",
                    color: active ? meta.color : "#71717a",
                  }}
                >
                  <span>{meta.emoji}</span>
                  <span>{meta.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Backdrop to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
          aria-hidden
        />
      )}
    </div>
  );
}
