"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type QueryParamValue = string | number | boolean | null | undefined;

export function useUrlQueryParams() {
  const [paramsSnapshot, setParamsSnapshot] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.location.search.startsWith("?")
      ? window.location.search.slice(1)
      : window.location.search;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncFromLocation = () => {
      const next = window.location.search.startsWith("?")
        ? window.location.search.slice(1)
        : window.location.search;
      setParamsSnapshot(next);
    };

    syncFromLocation();
    window.addEventListener("popstate", syncFromLocation);
    return () => window.removeEventListener("popstate", syncFromLocation);
  }, []);

  const searchParams = useMemo(
    () => new URLSearchParams(paramsSnapshot),
    [paramsSnapshot]
  );

  const setQueryParams = useCallback(
    (updates: Record<string, QueryParamValue>) => {
      if (typeof window === "undefined") return;

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
      window.history.replaceState(window.history.state, "", url);
      setParamsSnapshot(nextString);
    },
    []
  );

  return { searchParams, setQueryParams };
}
