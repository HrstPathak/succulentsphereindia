"use client";

import { Check, Plus } from "lucide-react";
import { useMemo, useRef, useState } from "react";

export type CollectionPickerProps = {
  /** Collections that already exist in the catalog. */
  options: string[];
  /** Currently assigned collections. */
  value: string[];
  onChange: (next: string[]) => void;
  id?: string;
};

function normalizeHandle(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Collection assignment control.
 *
 * Replaces the old free-text field, which let you type a typo ("succulents ")
 * that silently created a brand-new, empty collection. You now pick from the
 * collections that already exist, tick a product into any number of them, and
 * can still create a new one inline.
 *
 * Values are stored as handles (the same slug form the storefront routes use),
 * so a checkbox here maps 1:1 to a real /collections/<handle> page.
 */
export default function CollectionPicker({ options, value, onChange, id }: CollectionPickerProps) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const normalizedValue = useMemo(
    () => value.map((entry) => String(entry).trim()).filter(Boolean),
    [value],
  );

  const selectedSet = useMemo(() => new Set(normalizedValue), [normalizedValue]);

  // Existing collections first, then anything already assigned but not in the
  // list, so an assigned collection is always visible and removable.
  const allOptions = useMemo(() => {
    const merged = [...options, ...normalizedValue];
    return Array.from(new Set(merged.map((entry) => String(entry).trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [options, normalizedValue]);

  const visibleOptions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return allOptions;
    return allOptions.filter((entry) => entry.toLowerCase().includes(needle));
  }, [allOptions, query]);

  const suggestedNew = useMemo(() => {
    const candidate = normalizeHandle(query);
    if (!candidate) return "";
    if (allOptions.some((entry) => entry.toLowerCase() === candidate)) return "";
    return candidate;
  }, [allOptions, query]);

  const toggle = (entry: string) => {
    const next = selectedSet.has(entry)
      ? normalizedValue.filter((item) => item !== entry)
      : [...normalizedValue, entry];
    onChange(next);
  };

  const createNew = () => {
    const candidate = suggestedNew;
    if (!candidate) return;
    if (!selectedSet.has(candidate)) onChange([...normalizedValue, candidate]);
    setQuery("");
    setCreating(false);
  };

  return (
    <div className="mt-1 rounded-xl border border-[#d7e0d9] bg-white">
      {/* Selected chips */}
      <div className="flex flex-wrap gap-1.5 p-2">
        {normalizedValue.length === 0 ? (
          <span className="text-xs text-[#617366]">No collections selected yet.</span>
        ) : (
          normalizedValue.map((entry) => (
            <span
              key={entry}
              className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200"
            >
              <Check className="h-3 w-3" aria-hidden="true" />
              {entry}
              <button
                type="button"
                onClick={() => toggle(entry)}
                className="ml-0.5 rounded-full px-1 text-emerald-700 hover:bg-emerald-100"
                aria-label={`Remove ${entry} from collections`}
              >
                &times;
              </button>
            </span>
          ))
        )}
      </div>

      {/* Filter + create */}
      <div className="flex gap-2 border-t border-[#e6ece7] p-2">
        <input
          id={id}
          ref={inputRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setCreating(true);
          }}
          onFocus={() => setCreating(true)}
          onBlur={() => {
            // Delay so a click on "Create" still registers.
            window.setTimeout(() => setCreating(false), 120);
          }}
          placeholder="Search collections or create a new one"
          className="w-full rounded-lg border border-[#d7e0d9] px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#6f9878]"
        />
        {suggestedNew ? (
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={createNew}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#24563e] px-2.5 py-1.5 text-xs font-bold text-white"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Add
          </button>
        ) : null}
      </div>

      {/* Checkbox list */}
      {creating || visibleOptions.length ? (
        <div className="max-h-48 overflow-y-auto border-t border-[#e6ece7] p-1.5">
          {visibleOptions.length === 0 ? (
            <p className="px-1.5 py-2 text-xs text-[#617366]">No matching collections.</p>
          ) : (
            visibleOptions.map((entry) => (
              <label
                key={entry}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-[#35543f] hover:bg-[#f3f8f3]"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#24563e]"
                  checked={selectedSet.has(entry)}
                  onChange={() => toggle(entry)}
                />
                <span className="truncate">{entry}</span>
              </label>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}