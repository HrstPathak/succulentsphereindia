"use client";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

type Option = { value: string; label: string };

export default function Dropdown({
  label,
  options,
  value,
  onChange,
  leadingIcon
}: {
  label?: string;
  options: Option[];
  value: string;
  onChange: (v: string) => void;
  leadingIcon?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!btnRef.current || !listRef.current) return;
      if (
        !btnRef.current.contains(e.target as Node) &&
        !listRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (open && listRef.current) {
      const active = listRef.current.querySelector('[aria-selected="true"]') as HTMLElement | null;
      (active ?? listRef.current.firstElementChild)?.scrollIntoView?.({ block: "nearest" });
    }
  }, [open]);

  function onKeyDown(e: React.KeyboardEvent) {
    const items = listRef.current?.querySelectorAll<HTMLLIElement>("li[role='menuitem']") ?? [];
    const currentIndex = Array.from(items).findIndex((n) => n.getAttribute("data-value") === value);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = items[Math.min(items.length - 1, Math.max(0, currentIndex + 1))];
      next?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = items[Math.max(0, currentIndex - 1)];
      prev?.focus();
    } else if (e.key === "Escape") {
      setOpen(false);
      btnRef.current?.focus();
    }
  }

  return (
    <div className="relative inline-block text-left">
      {label && <span className="sr-only">{label}</span>}
      <div>
        <button
          ref={btnRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((s) => !s)}
          className="inline-flex justify-center items-center gap-2 rounded-xl border px-4 py-2 bg-white dark:bg-[#0a1420] text-[var(--color-text)] border-gray-300 dark:border-gray-600 text-sm font-medium shadow-sm hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-md dark:shadow-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] focus:ring-offset-1 dark:focus:ring-offset-[#071018] transition-all duration-200"
        >
          {leadingIcon && <span className="inline-flex items-center opacity-80">{leadingIcon}</span>}
          <span className="text-sm font-medium">{options.find((o) => o.value === value)?.label ?? "Sort"}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="opacity-70 transition-transform" style={{ transform: open ? "rotateZ(180deg)" : "rotateZ(0deg)" }}>
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {open && (
        <ul
          ref={listRef}
          role="menu"
          tabIndex={-1}
          onKeyDown={onKeyDown}
          className="absolute right-0 mt-3 w-56 origin-top-right divide-y divide-gray-100 dark:divide-gray-700 rounded-xl bg-white dark:bg-[#0a1420] shadow-xl dark:shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 focus:outline-none z-50"
        >
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <li
                key={opt.value}
                role="menuitem"
                tabIndex={0}
                data-value={opt.value}
                aria-selected={active}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onChange(opt.value);
                    setOpen(false);
                  }
                }}
                className={`px-4 py-3 text-sm cursor-pointer transition-colors font-medium ${
                  active 
                    ? "bg-[var(--color-brand)] text-white" 
                    : "text-[var(--color-text)] hover:bg-gray-50 dark:hover:bg-[#0f1f2e]"
                }`}
              >
                {opt.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
