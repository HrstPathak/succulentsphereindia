"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { SlidersHorizontal, X } from "lucide-react";
import { PRICE_MAX, PRICE_MIN, type SearchFilters } from "../../context/FilterContext";
import { formatINR } from "@/lib/currency";
import { resolveCollectionHandle } from "@/lib/productFilters";

interface FilterDrawerProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  facets: {
    plantGenus: string[];
    careLevel: string[];
    potSize: string[];
    potMaterial: string[];
    priceRange: { min: number; max: number };
  };
  hideCollections?: boolean;
  forcedCollection?: string | null;
}

const EMPTY_FILTERS: SearchFilters = {
  collections: [],
  plantType: [],
  careLevel: [],
  potSize: [],
  potMaterial: [],
  availability: false,
  priceRange: { min: PRICE_MIN, max: PRICE_MAX },
};

const CATEGORY_OPTIONS = [
  { value: "succulents", label: "Succulents" },
  { value: "cacti", label: "Cactus" },
  { value: "pots", label: "Pots" },
];

export default function FilterDrawer({
  filters,
  onFiltersChange,
  facets,
  hideCollections = false,
  forcedCollection,
}: FilterDrawerProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [localFilters, setLocalFilters] = useState(filters);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("keydown", onKey);
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.removeEventListener("keydown", onKey);
        document.body.style.overflow = prev;
      };
    }
    return;
  }, [open]);

  const applyFilters = (next: SearchFilters) => {
    setLocalFilters(next);
    onFiltersChange(next);
  };

  const handleMultiSelectChange = (
    category: "plantType" | "careLevel" | "potSize" | "potMaterial",
    value: string
  ) => {
    const arr = localFilters[category];
    const next: SearchFilters = {
      ...localFilters,
      [category]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
    };
    applyFilters(next);
  };

  const handleAvailabilityChange = () => {
    applyFilters({ ...localFilters, availability: !localFilters.availability });
  };

  const setCategory = (collectionValue: string) => {
    const normalized = resolveCollectionHandle(collectionValue);
    const isSelected = localFilters.collections.includes(normalized);
    const collections = isSelected ? [] : [normalized];
    const next: SearchFilters = {
      ...localFilters,
      collections,
      plantType: [],
      careLevel: [],
      potSize: [],
      potMaterial: [],
    };
    applyFilters(next);
  };

  const effectiveCategory =
    (hideCollections ? forcedCollection : localFilters.collections[0]) || "";
  const resolvedCategory = resolveCollectionHandle(effectiveCategory);
  const showSucculentFilters = resolvedCategory === "succulents";
  const showCactusFilters = resolvedCategory === "cacti";
  const showPotFilters = resolvedCategory === "pots";

  const sliderMin = Math.max(PRICE_MIN, facets.priceRange?.min ?? PRICE_MIN);
  const sliderMax = Math.min(PRICE_MAX, facets.priceRange?.max ?? PRICE_MAX);
  const sliderSpan = Math.max(1, sliderMax - sliderMin);

  const activeFiltersCount = (
    (hideCollections ? 0 : localFilters.collections.length) +
    localFilters.plantType.length +
    localFilters.careLevel.length +
    localFilters.potSize.length +
    localFilters.potMaterial.length +
    (localFilters.availability ? 1 : 0) +
    (localFilters.priceRange.min !== sliderMin || localFilters.priceRange.max !== sliderMax ? 1 : 0)
  );

  const minPct = ((localFilters.priceRange.min - sliderMin) / sliderSpan) * 100;
  const maxPct = ((localFilters.priceRange.max - sliderMin) / sliderSpan) * 100;

  const updatePrice = (type: "min" | "max", raw: number) => {
    const value = Math.max(sliderMin, Math.min(sliderMax, Math.round(raw)));
    const gap = Math.min(50, Math.max(1, Math.floor(sliderSpan / 20)));
    const next =
      type === "min"
        ? {
            ...localFilters,
            priceRange: {
              min: Math.min(value, localFilters.priceRange.max - gap),
              max: localFilters.priceRange.max,
            },
          }
        : {
            ...localFilters,
            priceRange: {
              min: localFilters.priceRange.min,
              max: Math.max(value, localFilters.priceRange.min + gap),
            },
          };
    applyFilters(next);
  };

  const clearAllFilters = () => {
    const reset: SearchFilters = {
      ...EMPTY_FILTERS,
      collections: hideCollections && forcedCollection ? [resolveCollectionHandle(forcedCollection)] : [],
      priceRange: { min: sliderMin, max: sliderMax },
    };
    applyFilters(reset);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-medium bg-white dark:bg-[#0a1420] text-[var(--color-text)] hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-md dark:shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] focus:ring-offset-1 dark:focus:ring-offset-[#071018] relative"
        aria-expanded={open}
        aria-controls="filters-drawer"
      >
        <SlidersHorizontal size={17} strokeWidth={1.9} />
        <span>Filter</span>
        {activeFiltersCount > 0 && (
          <span className="ml-1 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-[var(--color-brand)] rounded-full">
            {activeFiltersCount}
          </span>
        )}
      </button>

      {mounted && open && createPortal(
        <div
          id="filters-drawer"
          className="fixed inset-0 z-[2147483645]"
          role="dialog"
          aria-modal="true"
        >
          <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
          <aside
            className="absolute left-0 bg-white dark:bg-[#071018] w-80 max-w-[88vw] p-6 overflow-auto border-r border-gray-100 dark:border-gray-800 shadow-2xl"
            style={{ top: 0, height: "100%" }}
          >
            <div className="flex items-center justify-between mb-6">
              <h4 className="font-semibold text-lg text-[var(--color-text)]">Filters</h4>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={clearAllFilters}
                  disabled={activeFiltersCount === 0}
                  className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-[var(--color-text)] hover:bg-gray-100 dark:hover:bg-[#0a1420] disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  Clear all
                </button>
                <button type="button" onClick={() => setOpen(false)} aria-label="Close filters" className="inline-flex items-center justify-center h-9 w-9 rounded-lg hover:bg-gray-100 dark:hover:bg-[#0a1420] text-[var(--color-text)] transition-colors font-medium">
                  <X size={17} strokeWidth={2} />
                </button>
              </div>
            </div>

            <div className="space-y-6">
              {!hideCollections && (
                <div>
                  <h5 className="text-sm font-semibold mb-3 text-[var(--color-text)] uppercase tracking-wide text-opacity-70">Category</h5>
                  {CATEGORY_OPTIONS.map((category) => (
                    <label key={category.value} className="block text-sm text-[var(--color-text)] mb-2 hover:text-[var(--color-brand)] transition-colors cursor-pointer">
                      <input
                        type="checkbox"
                        className="mr-2 rounded"
                        checked={localFilters.collections.includes(category.value)}
                        onChange={() => setCategory(category.value)}
                      />
                      {category.label}
                    </label>
                  ))}
                </div>
              )}

              {showSucculentFilters && (
                <>
                  <div className={hideCollections ? "" : "border-t border-gray-100 dark:border-gray-800 pt-4"}>
                    <h5 className="text-sm font-semibold mb-3 text-[var(--color-text)] uppercase tracking-wide text-opacity-70">Plant Type</h5>
                    {facets.plantGenus.map((type) => (
                      <label key={type} className="block text-sm text-[var(--color-text)] mb-2 hover:text-[var(--color-brand)] transition-colors cursor-pointer">
                        <input
                          type="checkbox"
                          className="mr-2 rounded"
                          checked={localFilters.plantType.includes(type)}
                          onChange={() => handleMultiSelectChange("plantType", type)}
                        />
                        {type}
                      </label>
                    ))}
                  </div>
                </>
              )}

              {(showSucculentFilters || showCactusFilters) && (
                <>

                  <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                    <h5 className="text-sm font-semibold mb-3 text-[var(--color-text)] uppercase tracking-wide text-opacity-70">Care Level</h5>
                    {facets.careLevel.map((level) => (
                      <label key={level} className="block text-sm text-[var(--color-text)] mb-2 hover:text-[var(--color-brand)] transition-colors cursor-pointer">
                        <input
                          type="checkbox"
                          className="mr-2 rounded"
                          checked={localFilters.careLevel.includes(level)}
                          onChange={() => handleMultiSelectChange("careLevel", level)}
                        />
                        {level}
                      </label>
                    ))}
                  </div>
                </>
              )}

              {showPotFilters && (
                <>
                  <div className={hideCollections ? "" : "border-t border-gray-100 dark:border-gray-800 pt-4"}>
                    <h5 className="text-sm font-semibold mb-3 text-[var(--color-text)] uppercase tracking-wide text-opacity-70">Size</h5>
                    {facets.potSize.map((size) => (
                      <label key={size} className="block text-sm text-[var(--color-text)] mb-2 hover:text-[var(--color-brand)] transition-colors cursor-pointer">
                        <input
                          type="checkbox"
                          className="mr-2 rounded"
                          checked={localFilters.potSize.includes(size)}
                          onChange={() => handleMultiSelectChange("potSize", size)}
                        />
                        {size}
                      </label>
                    ))}
                  </div>

                  <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                    <h5 className="text-sm font-semibold mb-3 text-[var(--color-text)] uppercase tracking-wide text-opacity-70">Material</h5>
                    {facets.potMaterial.map((material) => (
                      <label key={material} className="block text-sm text-[var(--color-text)] mb-2 hover:text-[var(--color-brand)] transition-colors cursor-pointer">
                        <input
                          type="checkbox"
                          className="mr-2 rounded"
                          checked={localFilters.potMaterial.includes(material)}
                          onChange={() => handleMultiSelectChange("potMaterial", material)}
                        />
                        {material}
                      </label>
                    ))}
                  </div>
                </>
              )}

              <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                <h5 className="text-sm font-semibold mb-3 text-[var(--color-text)] uppercase tracking-wide text-opacity-70">Availability</h5>
                <label className="block text-sm text-[var(--color-text)] hover:text-[var(--color-brand)] transition-colors cursor-pointer">
                  <input
                    type="checkbox"
                    className="mr-2 rounded"
                    checked={localFilters.availability}
                    onChange={handleAvailabilityChange}
                  />
                  In Stock Only
                </label>
              </div>

              <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                <h5 className="text-sm font-semibold mb-3 text-[var(--color-text)] uppercase tracking-wide text-opacity-70">Price Range</h5>
                <div className="mb-3 flex items-center justify-between text-xs font-medium text-[var(--color-text)]">
                  <span>{formatINR(localFilters.priceRange.min, 0)}</span>
                  <span>{formatINR(localFilters.priceRange.max, 0)}</span>
                </div>
                <div className="relative h-10">
                  <div className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-gray-200 dark:bg-gray-700" />
                  <div
                    className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[var(--color-brand)]"
                    style={{ left: `${minPct}%`, width: `${Math.max(0, maxPct - minPct)}%` }}
                  />
                  <input
                    type="range"
                    min={sliderMin}
                    max={sliderMax}
                    step={50}
                    value={localFilters.priceRange.min}
                    onChange={(e) => updatePrice("min", Number(e.target.value))}
                    className="absolute left-0 top-1/2 w-full -translate-y-1/2 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--color-brand)] [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white"
                  />
                  <input
                    type="range"
                    min={sliderMin}
                    max={sliderMax}
                    step={50}
                    value={localFilters.priceRange.max}
                    onChange={(e) => updatePrice("max", Number(e.target.value))}
                    className="absolute left-0 top-1/2 w-full -translate-y-1/2 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--color-brand)] [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white"
                  />
                </div>
              </div>
            </div>
          </aside>
        </div>,
        document.body
      )}
    </>
  );
}

