"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

export type QueryParamValue = string | number | boolean | null | undefined;

/**
 * One shared reader for `window.location.search`.
 *
 * Why this is not a `popstate` listener: Next.js App Router performs soft
 * navigations for `<Link>` clicks through its own patched `history.pushState`,
 * and that does NOT fire `popstate`. A popstate-only reader therefore goes stale
 * after the very first in-app navigation -- which is exactly how the shop grid
 * kept rendering page 7 while the address bar already said `?page=8`.
 *
 * So we wrap `pushState` / `replaceState` as well, publish every change through
 * a tiny external store, and read it with `useSyncExternalStore`:
 *
 * - one shared listener set no matter how many consumers mount, so the cost does
 *   not grow with the number of components reading the URL
 * - `getServerSnapshot` keeps the server render and the first client render
 *   identical, so there is no hydration mismatch
 * - the wrappers are marked per-function and re-checked on every subscribe, so
 *   they survive Next.js restoring the native history methods
 */
type Listener = () => void;

const EMPTY_SEARCH = "";
const PATCHED_MARKER = "__ssQueryParamsPatched";

const listeners = new Set<Listener>();
let snapshot = EMPTY_SEARCH;
let popstateBound = false;

function readLocationSearch(): string {
  if (typeof window === "undefined") return EMPTY_SEARCH;
  return window.location.search;
}

function getSnapshot(): string {
  return snapshot;
}

function getServerSnapshot(): string {
  return EMPTY_SEARCH;
}

function emit(): void {
  const next = readLocationSearch();
  // Guarded so a no-op navigation never re-renders every subscriber.
  if (next === snapshot) return;
  snapshot = next;
  for (const listener of listeners) {
    listener();
  }
}

function wrapHistoryMethod(method: "pushState" | "replaceState"): void {
  const history = window.history as unknown as Record<string, unknown>;
  const original = history[method] as Record<string, unknown> | undefined;
  if (!original || original[PATCHED_MARKER]) return;

  const wrapped = function (this: History, ...args: unknown[]) {
    const result = (original as unknown as (...a: unknown[]) => unknown).apply(this, args);
    // The URL is already updated by the time the original returns, so reading
    // it here catches Next.js navigations, plain history writes and third-party
    // deep links alike.
    emit();
    return result;
  };
  (wrapped as unknown as Record<string, unknown>)[PATCHED_MARKER] = true;

  history[method] = wrapped;
}

function bindPopState(): void {
  if (popstateBound || typeof window.addEventListener !== "function") return;
  popstateBound = true;
  window.addEventListener("popstate", emit);
}

function subscribe(listener: Listener): () => void {
  if (typeof window === "undefined") return () => {};

  // Re-sync in case the URL moved between render and subscription.
  const current = readLocationSearch();
  if (current !== snapshot) snapshot = current;

  listeners.add(listener);
  wrapHistoryMethod("pushState");
  wrapHistoryMethod("replaceState");
  bindPopState();

  return () => {
    listeners.delete(listener);
  };
}

export function useUrlQueryParams() {
  const rawSearch = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Memoized on the raw string so the URLSearchParams identity stays stable
  // across renders -- downstream memos in the catalog grid depend on it.
  const searchParams = useMemo(() => new URLSearchParams(rawSearch), [rawSearch]);

  const setQueryParams = useCallback(
    (updates: Record<string, QueryParamValue>) => {
      if (typeof window === "undefined") return;

      wrapHistoryMethod("pushState");
      wrapHistoryMethod("replaceState");
      bindPopState();

      const next = new URLSearchParams(window.location.search);

      for (const [key, rawValue] of Object.entries(updates)) {
        if (rawValue === null || rawValue === undefined || rawValue === "") {
          next.delete(key);
          continue;
        }
        const value = typeof rawValue === "boolean" ? (rawValue ? "true" : "false") : String(rawValue);
        next.set(key, value);
      }

      const currentString = window.location.search.startsWith("?")
        ? window.location.search.slice(1)
        : window.location.search;
      const nextString = next.toString();
      if (currentString === nextString) return;

      const hash = window.location.hash || "";
      const url = nextString
        ? `${window.location.pathname}?${nextString}${hash}`
        : `${window.location.pathname}${hash}`;

      // Preserves `window.history.state`, which the App Router relies on. The
      // patched replaceState publishes the change to every subscriber.
      window.history.replaceState(window.history.state, "", url);
      emit();
    },
    []
  );

  return { searchParams, setQueryParams };
}