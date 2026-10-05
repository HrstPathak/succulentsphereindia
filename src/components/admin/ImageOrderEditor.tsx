"use client";

import { GripVertical, Star, Trash2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";

export type ImageOrderEditorProps = {
  images: string[];
  onChange: (images: string[]) => void;
  /** Compact tiles are used in the narrow aside column. */
  tileHeightClass?: string;
};

/**
 * Drag-and-drop ordering for a product's photos.
 *
 * The first tile is the MAIN image: the storefront renders `images[0]` as the
 * hero on product cards, the product gallery and the best-seller tiles, so this
 * order is the single source of truth for how a product looks everywhere.
 *
 * Works with mouse AND touch via the native HTML5 drag events plus the
 * "Make main" button, which also makes the control usable from the keyboard (a
 * drag-only UI would be unusable without a pointer).
 *
 * Deliberately dependency-free: adding a drag library would add ~30KB to the
 * admin bundle for behaviour this file implements in a few dozen lines.
 */
export default function ImageOrderEditor({
  images,
  onChange,
  tileHeightClass = "h-20",
}: ImageOrderEditorProps) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  // Refs mirror the drag state so the drop handler never closes over a stale value.
  const dragIndexRef = useRef<number | null>(null);
  const overIndexRef = useRef<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const move = useCallback(
    (from: number, to: number) => {
      if (from === to || from < 0 || to < 0 || from >= images.length || to >= images.length) return;
      const next = [...images];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      onChange(next);
    },
    [images, onChange],
  );

  const handleDragStart = (index: number) => {
    dragIndexRef.current = index;
    setDraggingIndex(index);
  };

  const handleDragOver = (event: React.DragEvent, index: number) => {
    // preventDefault is what actually marks this tile as a valid drop target.
    event.preventDefault();
    if (dragIndexRef.current === null) return;
    if (overIndexRef.current !== index) {
      overIndexRef.current = index;
      setOverIndex(index);
    }
  };

  const handleDrop = (event: React.DragEvent, index: number) => {
    event.preventDefault();
    const from = dragIndexRef.current;
    if (from !== null) move(from, index);
    handleDragEnd();
  };

  const handleDragEnd = () => {
    dragIndexRef.current = null;
    overIndexRef.current = null;
    setDraggingIndex(null);
    setOverIndex(null);
  };

  const removeAt = (index: number) => onChange(images.filter((_, i) => i !== index));

  return (
    <div className="grid grid-cols-3 gap-2">
      {images.map((url, index) => {
        const isMain = index === 0;
        const isDragging = draggingIndex === index;
        const isOver = overIndex === index && draggingIndex !== null && draggingIndex !== index;

        return (
          <div
            key={`${url}-${index}`}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(event) => handleDragOver(event, index)}
            onDrop={(event) => handleDrop(event, index)}
            onDragEnd={handleDragEnd}
            className={`group relative overflow-hidden rounded-lg border bg-white transition ${
              isMain ? "border-emerald-600 ring-2 ring-emerald-600/25" : "border-[#d7e0d9]"
            } ${isDragging ? "opacity-40" : ""} ${isOver ? "ring-2 ring-emerald-500" : ""}`}
          >
            <img
              src={url}
              alt={isMain ? "Main product image" : `Product image ${index + 1}`}
              loading="lazy"
              className={`w-full ${tileHeightClass} object-cover`}
              // A broken URL must not leave an empty tile behind.
              onError={(event) => {
                event.currentTarget.style.visibility = "hidden";
              }}
            />

            {/* Position number, so the drag order is unambiguous. */}
            <span className="absolute left-1 top-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {index + 1}
            </span>

            {isMain ? (
              <span className="absolute bottom-1 left-1 inline-flex items-center gap-1 rounded-md bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                <Star className="h-2.5 w-2.5" aria-hidden="true" />
                Main
              </span>
            ) : null}

            {/* Drag handle: a visible affordance so reordering is discoverable. */}
            <span
              className="pointer-events-none absolute right-1 top-1 rounded-md bg-black/55 p-0.5 text-white opacity-0 transition group-hover:opacity-100"
              aria-hidden="true"
            >
              <GripVertical className="h-3 w-3" />
            </span>

            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/60 px-1 py-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
              {isMain ? (
                <span className="rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-bold text-[#24563e]">
                  Hero
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => move(index, 0)}
                  className="rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-bold text-[#24563e]"
                  title="Make this the main image"
                  aria-label={`Make image ${index + 1} the main image`}
                >
                  Make main
                </button>
              )}
              <button
                type="button"
                onClick={() => removeAt(index)}
                className="rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white"
                title="Remove image"
                aria-label={`Remove image ${index + 1}`}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}