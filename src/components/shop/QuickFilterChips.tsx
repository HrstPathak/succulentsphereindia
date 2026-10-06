"use client";

import React from "react";
import { Trash2 } from "lucide-react";
import { CATALOG_CHIPS } from "@/lib/catalogChips";

/**
 * Horizontally scrollable quick-pick chips shown under the filter bar and above
 * the product grid. Multi-select: every selected chip is OR-ed together by
 * `/api/products`, so picking "Succulent" + "Combo" shows both.
 *
 * Selected styling reuses the Add-to-Cart green (#059669) for the border and the
 * same colour at 12% opacity as the fill, so a selected chip reads as "pressed".
 */
function Chip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`shrink-0 whitespace-nowrap rounded-lg border px-3.5 py-1.5 text-[13px] font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]/40 ${
        selected
          ? "border-[#059669] bg-[rgba(5,150,105,0.12)] text-[#047857] shadow-[0_2px_8px_rgba(5,150,105,0.18)] dark:text-[#34d399]"
          : "border-gray-200 bg-white text-[rgb(var(--ss-text-rgb)/0.75)] hover:border-[rgba(5,150,105,0.5)] hover:text-[#047857] dark:border-gray-700 dark:bg-gray-900 dark:hover:border-[rgba(5,150,105,0.6)]"
      }`}
    >
      {label}
    </button>
  );
}

export default function QuickFilterChips({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const activeIds = Array.isArray(selected) ? selected : [];
  const hasSelection = activeIds.length > 0;

  const toggle = (id: string) => {
    if (activeIds.includes(id)) {
      onChange(activeIds.filter((value) => value !== id));
      return;
    }
    onChange([...activeIds, id]);
  };

  return (
    <div className="mt-4 flex items-center gap-2" data-testid="quick-filter-chips">
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Chip label="All" selected={!hasSelection} onClick={() => onChange([])} />
        {CATALOG_CHIPS.map((chip) => (
          <Chip
            key={chip.id}
            label={chip.label}
            selected={activeIds.includes(chip.id)}
            onClick={() => toggle(chip.id)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => onChange([])}
        disabled={!hasSelection}
        aria-label="Clear all selected chips"
        title="Clear selection"
        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-all duration-200 ${
          hasSelection
            ? "border-[#059669] bg-[rgba(5,150,105,0.12)] text-[#047857] hover:bg-[rgba(5,150,105,0.2)] dark:text-[#34d399]"
            : "cursor-not-allowed border-gray-200 bg-white text-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-600"
        }`}
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
