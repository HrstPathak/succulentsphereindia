"use client";

import { useEffect, useState } from "react";

export default function QuantitySelector({
  value = 1,
  onChange,
  compact = false,
}: {
  value?: number;
  onChange?: (n: number) => void;
  compact?: boolean;
}) {
  const [count, setCount] = useState(value);
  useEffect(() => {
    setCount(Math.max(1, value));
  }, [value]);

  function update(n: number) {
    const next = Math.max(1, n);
    setCount(next);
    onChange?.(next);
  }

  const buttonClass = compact
    ? "flex h-9 w-9 items-center justify-center rounded border border-gray-200 text-lg leading-none"
    : "flex h-12 w-12 items-center justify-center rounded border border-gray-200 text-2xl leading-none";
  const inputClass = compact
    ? "h-9 w-12 rounded border border-gray-200 py-1 text-center text-sm font-medium"
    : "h-12 w-16 rounded border border-gray-200 py-2 text-center text-base font-medium";

  return (
    <div className={`inline-flex items-center ${compact ? "gap-1.5" : "gap-2"}`} role="group" aria-label="Quantity selector">
      <button
        onClick={() => update(count - 1)}
        aria-label="Decrease quantity"
        className={buttonClass}
      >
        -
      </button>
      <input
        aria-label="Quantity"
        value={count}
        onChange={(e) => update(Number(e.target.value || 1))}
        className={inputClass}
      />
      <button
        onClick={() => update(count + 1)}
        aria-label="Increase quantity"
        className={buttonClass}
      >
        +
      </button>
    </div>
  );
}
