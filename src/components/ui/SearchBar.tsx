"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { normalizeImageUrl, shouldBypassImageOptimization } from "@/lib/imageUrl";
import PriceWithDiscount from "@/components/shared/PriceWithDiscount";

type Result = {
  id: string;
  title: string;
  handle: string;
  price: string | null;
  compareAtPrice?: string | null;
  currency?: string | null;
  image: string | null;
  imageAlt?: string | null;
};

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const controllerRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const cacheRef = useRef<Record<string, Result[]>>({});

  const doSearch = useCallback(
    async (rawQuery: string) => {
      const normalizedQuery = rawQuery.trim().toLowerCase();
      if (normalizedQuery.length < 2) {
        setResults([]);
        setError(null);
        setLoading(false);
        return;
      }

      const cacheKey = normalizedQuery;

      if (cacheRef.current[cacheKey]) {
        setResults(cacheRef.current[cacheKey]);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      try {
        const params = new URLSearchParams({ q: normalizedQuery, limit: "8" });

        const response = await fetch(`/api/search?${params.toString()}`, { signal: controller.signal });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(String(payload?.error || "Search failed"));
        }

        const nextResults = Array.isArray(payload?.results) ? payload.results : [];
        if (nextResults.length > 0) {
          cacheRef.current[cacheKey] = nextResults;
        } else {
          delete cacheRef.current[cacheKey];
        }
        setResults(nextResults);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError((err as Error).message || "Search failed");
          setResults([]);
        }
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length >= 2) {
        doSearch(query);
        setOpen(true);
      } else {
        setResults([]);
        setOpen(false);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [query, doSearch]);

  useEffect(() => {
    function onDocumentMouseDown(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (!target.closest(".ss-search-wrapper")) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onDocumentMouseDown);
    return () => document.removeEventListener("mousedown", onDocumentMouseDown);
  }, []);

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current) => Math.min(current + 1, results.length - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === "Enter" && active >= 0 && results[active]) {
      window.location.href = `/products/${results[active].handle}`;
      return;
    }
    if (event.key === "Escape") {
      setOpen(false);
    }
  }

  function clear() {
    setQuery("");
    setResults([]);
    setOpen(false);
    inputRef.current?.focus();
  }

  return (
    <div className="ss-search-wrapper relative">
      <div
        className="flex items-center rounded-xl border border-gray-200 bg-white transition-all duration-200 hover:border-gray-300 focus-within:border-[var(--color-brand)] focus-within:shadow-md dark:border-gray-700 dark:bg-[#0a1420] dark:hover:border-gray-600"
        style={{ height: 48 }}
      >
        <Search className="ml-4 mr-3 shrink-0 text-gray-400 dark:text-gray-500" size={18} strokeWidth={1.8} />
        <input
          ref={inputRef}
          aria-label="Search plants"
          role="combobox"
          aria-expanded={open}
          aria-controls="search-listbox"
          placeholder="Search plants, succulents..."
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(-1);
          }}
          onKeyDown={onKeyDown}
          className="flex-1 bg-transparent px-1 py-2 text-sm text-[var(--color-text)] placeholder:text-gray-400 focus:outline-none dark:placeholder:text-gray-500"
          style={{ minHeight: 44 }}
        />
        {query.length > 0 ? (
          <button
            onClick={clear}
            aria-label="Clear search"
            className="mr-2 flex shrink-0 items-center justify-center rounded p-2 transition-colors hover:bg-gray-100 dark:hover:bg-[#0f1f2e]"
          >
            <X size={18} strokeWidth={2} />
          </button>
        ) : null}
      </div>

      {open ? (
        <div
          id="search-listbox"
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-3 max-h-80 overflow-auto rounded-xl border border-gray-100 bg-white shadow-xl dark:border-gray-700 dark:bg-[#0a1420] dark:shadow-2xl"
          style={{ borderRadius: 14 }}
        >
          {loading ? (
            <div className="space-y-4 p-5">
              {[0, 1, 2].map((item) => (
                <div key={item} className="flex animate-pulse items-center gap-4">
                  <div className="h-14 w-14 shrink-0 rounded-lg bg-gradient-to-br from-gray-200 to-gray-100 dark:from-gray-700 dark:to-gray-600" />
                  <div className="flex-1 space-y-3">
                    <div className="h-3 w-3/4 rounded bg-gradient-to-r from-gray-200 to-gray-100 dark:from-gray-700 dark:to-gray-600" />
                    <div className="h-2 w-1/2 rounded bg-gray-100 dark:bg-gray-700" />
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {!loading && results.length === 0 ? (
            <div className="p-6 text-center">
              <div className="mb-2 text-4xl">Plant</div>
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {error ? "Search unavailable" : "No plants found"}
              </div>
              <div className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                {error || "Try searching for a different plant"}
              </div>
            </div>
          ) : null}

          {!loading
            ? results.map((result, idx) => {
                const normalizedQuery = query.trim();
                const text = result.title;
                const at = text.toLowerCase().indexOf(normalizedQuery.toLowerCase());
                const highlighted =
                  at === -1 || !normalizedQuery ? (
                    text
                  ) : (
                    <>
                      {text.slice(0, at)}
                      <span className="font-semibold text-[var(--color-brand)]">
                        {text.slice(at, at + normalizedQuery.length)}
                      </span>
                      {text.slice(at + normalizedQuery.length)}
                    </>
                  );

                return (
                  <Link key={result.id} href={`/products/${result.handle}`} onClick={() => setOpen(false)}>
                    <div
                      role="option"
                      aria-selected={active === idx}
                      className={`flex items-center gap-4 border-b border-gray-50 px-5 py-4 transition-colors last:border-b-0 dark:border-gray-700 ${
                        active === idx ? "bg-[var(--color-bg)] dark:bg-[#0f1f2e]" : "hover:bg-gray-50 dark:hover:bg-[#0f1f2e]"
                      }`}
                    >
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-gray-100 dark:border-gray-600">
                        {result.image ? (
                          <Image
                            src={normalizeImageUrl(result.image)}
                            alt={result.imageAlt || result.title}
                            width={56}
                            height={56}
                            style={{ objectFit: "cover" }}
                            unoptimized={shouldBypassImageOptimization(result.image)}
                          />
                        ) : (
                          <div className="h-14 w-14 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-[var(--color-text)]">{highlighted}</div>
                      </div>
                      <div className="shrink-0">
                        {result.price ? (
                          <PriceWithDiscount
                            price={result.price}
                            compareAtPrice={result.compareAtPrice ?? null}
                            currency={result.currency || "INR"}
                            size="sm"
                            badgePlacement="below"
                            className="items-end text-right"
                          />
                        ) : (
                          <div className="text-sm font-semibold text-gray-400 dark:text-gray-500">-</div>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })
            : null}
        </div>
      ) : null}
    </div>
  );
}
