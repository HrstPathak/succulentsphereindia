 "use client";
import { useEffect, useRef, useState } from "react";

type DarkModeToggleProps = {
  variant?: "icon" | "inline";
  className?: string;
};

export default function DarkModeToggle({ variant = "icon", className = "" }: DarkModeToggleProps) {
  const [mode, setMode] = useState<"light" | "dark">("light");
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const iconRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("ss_theme") : null;
    if (stored === "dark") {
      setMode("dark");
      document.documentElement.classList.add("dark");
    } else {
      setMode("light");
      document.documentElement.classList.remove("dark");
    }
  }, []);

  function createRippleAndToggle(nextMode: "light" | "dark", originEl?: HTMLElement | null) {
    const source = originEl ?? btnRef.current;
    if (!source) {
      applyMode(nextMode);
      return;
    }
    const rect = source.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    // compute max distance to corners
    const w = Math.max(cx, window.innerWidth - cx);
    const h = Math.max(cy, window.innerHeight - cy);
    const radius = Math.sqrt(w * w + h * h);
    const size = radius * 2;

    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.left = `${cx - size / 2}px`;
    overlay.style.top = `${cy - size / 2}px`;
    overlay.style.width = `${size}px`;
    overlay.style.height = `${size}px`;
    overlay.style.borderRadius = "50%";
    overlay.style.transform = "scale(0)";
    overlay.style.background = nextMode === "dark" ? "#0b0b0b" : "#ffffff";
    overlay.style.zIndex = "2147483648";
    overlay.style.pointerEvents = "none";
    overlay.style.transition = "transform 420ms ease-out, opacity 300ms ease-out";
    document.body.appendChild(overlay);

    // trigger expand
    requestAnimationFrame(() => {
      overlay.style.transform = "scale(1)";
    });

    // after expand, toggle mode
    const onEnd = () => {
      overlay.removeEventListener("transitionend", onEnd);
      applyMode(nextMode);
      // fade out
      overlay.style.opacity = "0";
      setTimeout(() => {
        try {
          document.body.removeChild(overlay);
        } catch {}
      }, 300);
    };
    overlay.addEventListener("transitionend", onEnd);
  }

  function applyMode(next: "light" | "dark") {
    if (next === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    try {
      localStorage.setItem("ss_theme", next);
    } catch {}
    setMode(next);
  }

  function toggle() {
    const next = mode === "dark" ? "light" : "dark";
    const origin = variant === "inline" ? iconRef.current : btnRef.current;
    createRippleAndToggle(next, origin);
  }

  const nextMode = mode === "dark" ? "light" : "dark";

  if (variant === "inline") {
    return (
      <button
        ref={btnRef}
        type="button"
        aria-pressed={mode === "dark"}
        aria-label={`Switch to ${nextMode} mode`}
        onClick={toggle}
        className={`group inline-flex w-full items-center justify-between rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-sm text-gray-800 dark:text-gray-100 transition hover:border-[var(--color-brand)] hover:bg-gray-50 dark:hover:bg-white/5 ${className}`}
        title="Toggle theme"
      >
        <span className="font-medium">{mode === "dark" ? "Light Mode" : "Dark Mode"}</span>
        <span ref={iconRef} className="flex h-8 w-8 items-center justify-center rounded-full bg-white dark:bg-[#132129] border border-gray-200 dark:border-gray-700">
          <ThemeGlyph mode={mode} />
        </span>
      </button>
    );
  }

  return (
    <button
      ref={btnRef}
      type="button"
      aria-pressed={mode === "dark"}
      aria-label={`Switch to ${nextMode} mode`}
      onClick={toggle}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-900 transition hover:border-[var(--color-brand)] hover:bg-gray-50 dark:border-gray-700 dark:bg-[#132129] dark:text-gray-100 dark:hover:bg-white/5 ${className}`}
      title="Toggle theme"
    >
      <ThemeGlyph mode={mode} />
    </button>
  );
}

function ThemeGlyph({ mode }: { mode: "light" | "dark" }) {
  if (mode === "dark") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="4" fill="currentColor" />
        <path d="M12 2.6v2.3M12 19.1v2.3M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M2.6 12h2.3M19.1 12h2.3M4.9 19.1l1.7-1.7M17.4 6.6l1.7-1.7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M20.4 14.2a8.7 8.7 0 1 1-10.6-10.6 7.3 7.3 0 1 0 10.6 10.6Z" fill="currentColor" />
    </svg>
  );
}

