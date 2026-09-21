"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import {
  clearGuestWishlist,
  normalizeWishlistIds,
  readGuestWishlist,
  removeWishlistId,
  toggleWishlistId,
  toWishlistProducts,
  type WishlistProduct,
  writeGuestWishlist,
} from "@/lib/wishlist";

type WishlistApiResponse = {
  authenticated: boolean;
  items: string[];
  products: WishlistProduct[];
};

type WishlistInputProduct = WishlistProduct;

type WishlistContextValue = {
  ids: string[];
  products: WishlistProduct[];
  count: number;
  loading: boolean;
  isAuthenticated: boolean;
  isInWishlist: (productId: string) => boolean;
  toggle: (product: WishlistInputProduct) => Promise<{ added: boolean }>;
  add: (product: WishlistInputProduct) => Promise<void>;
  remove: (productId: string) => Promise<void>;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);

const jsonFetcher = async (url: string) => {
  const response = await fetch(url, { method: "GET", credentials: "include", cache: "no-store" });
  if (!response.ok) throw new Error("Unable to fetch wishlist.");
  return (await response.json()) as WishlistApiResponse;
};

async function getApiErrorMessage(response: Response, fallback: string) {
  const toText = (value: unknown): string => {
    if (typeof value === "string") return value;
    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      if (typeof record.message === "string") return record.message;
      if (typeof record.code === "string") return record.code;
      if (Array.isArray(record.field) && record.field.length > 0) {
        return record.field.map((item) => String(item)).join(".");
      }
      try {
        return JSON.stringify(value);
      } catch {
        return "";
      }
    }
    return value == null ? "" : String(value);
  };

  try {
    const payload = await response.json();
    if (Array.isArray(payload?.details) && payload.details.length > 0) {
      const firstDetail = toText(payload.details[0]);
      if (firstDetail) return firstDetail;
    }
    const errorText = toText(payload?.error);
    return errorText || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Guest wishlist hydration cache.
 *
 * Signed-out shoppers keep their wishlist in localStorage, so their products
 * are re-fetched by this provider on every full page load. Remembering the last
 * response lets /wishlist paint the saved items immediately and turns the
 * network call into a silent refresh.
 */
const GUEST_PRODUCTS_CACHE_KEY = "ss_wishlist_products_v1";
const GUEST_PRODUCTS_CACHE_TTL_MS = 5 * 60 * 1000;

type GuestProductsCache = { signature: string; savedAt: number; products: WishlistProduct[] };

function readGuestProductsCache(signature: string): WishlistProduct[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(GUEST_PRODUCTS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GuestProductsCache;
    if (parsed?.signature !== signature || !Array.isArray(parsed.products) || !parsed.products.length) return null;
    if (Date.now() - Number(parsed.savedAt || 0) > GUEST_PRODUCTS_CACHE_TTL_MS) return null;
    return parsed.products;
  } catch {
    return null;
  }
}

function writeGuestProductsCache(signature: string, products: WishlistProduct[]) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(GUEST_PRODUCTS_CACHE_KEY, JSON.stringify({ signature, savedAt: Date.now(), products }));
  } catch {
    // Storage disabled / quota exceeded — the in-memory copy still works.
  }
}

/** In-flight hydration requests, so a remount never duplicates a network call. */
const inFlightHydrations = new Map<string, Promise<WishlistProduct[]>>();

async function requestProductsByIds(ids: string[]): Promise<WishlistProduct[]> {
  if (!ids.length) return [];

  const signature = ids.join(",");
  const pending = inFlightHydrations.get(signature);
  if (pending) return pending;

  const request = (async () => {
    try {
      const response = await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "products", ids }),
      });
      if (!response.ok) return [];
      const payload = await response.json();
      return toWishlistProducts(payload?.products);
    } catch {
      return [];
    } finally {
      inFlightHydrations.delete(signature);
    }
  })();

  inFlightHydrations.set(signature, request);
  return request;
}

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [guestIds, setGuestIds] = useState<string[]>([]);
  const [guestProducts, setGuestProducts] = useState<WishlistProduct[]>([]);
  const [guestHydrating, setGuestHydrating] = useState(false);
  const [mergedGuest, setMergedGuest] = useState(false);
  // Guest products are mirrored in a ref: it is the synchronous source of truth
  // for "do we already hold this product?", so hearting or removing an item
  // never triggers a redundant hydration request.
  const guestProductsRef = useRef<WishlistProduct[]>([]);
  const hydratedGuestIdsRef = useRef<string[]>([]);

  const { data, mutate, isLoading } = useSWR<WishlistApiResponse>("/api/wishlist", jsonFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 15000,
  });

  const isAuthenticated = Boolean(data?.authenticated);

  const applyGuestProducts = useCallback(
    (updater: WishlistProduct[] | ((current: WishlistProduct[]) => WishlistProduct[])) => {
      const next = typeof updater === "function" ? updater(guestProductsRef.current) : updater;
      guestProductsRef.current = next;
      setGuestProducts(next);
    },
    []
  );

  useEffect(() => {
    const ids = readGuestWishlist();
    setGuestIds(ids);
  }, []);

  useEffect(() => {
    const onAuthChanged = () => {
      mutate();
    };
    window.addEventListener("auth:changed", onAuthChanged);
    return () => window.removeEventListener("auth:changed", onAuthChanged);
  }, [mutate]);

  useEffect(() => {
    if (!isAuthenticated) {
      setMergedGuest(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!guestIds.length) {
      hydratedGuestIdsRef.current = [];
      applyGuestProducts([]);
      setGuestHydrating(false);
      return;
    }

    // Every id is already in memory (a guest just hearted or removed an item):
    // align the order locally instead of re-fetching the whole grid.
    if (guestIds.every((id) => hydratedGuestIdsRef.current.includes(id))) {
      applyGuestProducts((current) => {
        const byId = new Map(current.map((item) => [item.id, item]));
        return guestIds.map((id) => byId.get(id)).filter((item): item is WishlistProduct => Boolean(item));
      });
      return;
    }

    const signature = guestIds.join(",");
    const cached = readGuestProductsCache(signature);
    if (cached) {
      applyGuestProducts(cached);
      hydratedGuestIdsRef.current = cached.map((item) => item.id);
      setGuestHydrating(false);
    } else {
      setGuestHydrating(true);
    }

    const missingIds = guestIds.filter(
      (id) => !hydratedGuestIdsRef.current.includes(id) && !guestProductsRef.current.some((item) => item.id === id)
    );
    let active = true;

    void requestProductsByIds(missingIds)
      .then((products) => {
        if (!active || !products.length) return;
        const byId = new Map([...guestProductsRef.current, ...products].map((item) => [item.id, item]));
        const next = guestIds.map((id) => byId.get(id)).filter((item): item is WishlistProduct => Boolean(item));
        applyGuestProducts(next);
        hydratedGuestIdsRef.current = normalizeWishlistIds([...hydratedGuestIdsRef.current, ...products.map((item) => item.id)]);
        writeGuestProductsCache(signature, next);
      })
      .finally(() => {
        if (active) setGuestHydrating(false);
      });

    return () => {
      active = false;
    };
  }, [applyGuestProducts, guestIds]);

  useEffect(() => {
    if (!isAuthenticated || mergedGuest || !guestIds.length) return;

    const merge = async () => {
      const response = await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "merge", ids: guestIds }),
      });
      if (!response.ok) return;
      const payload = (await response.json()) as WishlistApiResponse;
      clearGuestWishlist();
      setGuestIds([]);
      setGuestProducts([]);
      setMergedGuest(true);
      mutate(payload, false);
      window.dispatchEvent(new Event("wishlist:changed"));
    };

    merge();
  }, [guestIds, isAuthenticated, mergedGuest, mutate]);

  const ids = useMemo(() => (isAuthenticated ? normalizeWishlistIds(data?.items || []) : guestIds), [data?.items, guestIds, isAuthenticated]);
  const products = useMemo(
    () => (isAuthenticated ? (Array.isArray(data?.products) ? data!.products : []) : guestProducts),
    [data, guestProducts, isAuthenticated]
  );
  const idSet = useMemo(() => new Set(ids), [ids]);

  // Called by every product card on the page: a Set keeps membership O(1) (it
  // was an Array.includes scan per card) and a stable identity keeps memoized
  // cards from re-rendering on unrelated provider updates.
  const isInWishlist = useCallback((productId: string) => idSet.has(String(productId || "").trim()), [idSet]);

  const toggle = useCallback(async (product: WishlistInputProduct): Promise<{ added: boolean }> => {
    if (isAuthenticated) {
      const result = toggleWishlistId(ids, product.id);
      const optimisticProducts = result.added
        ? [product, ...products.filter((item) => item.id !== product.id)]
        : products.filter((item) => item.id !== product.id);

      try {
        await mutate(
          async () => {
            const response = await fetch("/api/wishlist", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "set", ids: result.nextIds }),
            });
            if (!response.ok) {
              throw new Error(await getApiErrorMessage(response, "Unable to update wishlist."));
            }
            const payload = (await response.json()) as WishlistApiResponse;
            return payload;
          },
          {
            optimisticData: { authenticated: true, items: result.nextIds, products: optimisticProducts },
            rollbackOnError: true,
            revalidate: false,
          }
        );
      } catch (error) {
        showErrorToast((error as Error).message || "Unable to update wishlist.");
        return { added: false };
      }

      if (result.added) showSuccessToast("Added to your Wishlist");
      window.dispatchEvent(new Event("wishlist:changed"));
      return { added: result.added };
    }

    const result = toggleWishlistId(guestIds, product.id);
    const nextIds = result.nextIds;

    applyGuestProducts((current) =>
      result.added ? [product, ...current.filter((item) => item.id !== product.id)] : current.filter((item) => item.id !== product.id)
    );
    // The product is now in memory, so the hydration effect must not fetch it.
    hydratedGuestIdsRef.current = result.added
      ? normalizeWishlistIds([product.id, ...hydratedGuestIdsRef.current])
      : hydratedGuestIdsRef.current.filter((id) => id !== product.id);

    setGuestIds(nextIds);
    writeGuestWishlist(nextIds);
    if (result.added) showSuccessToast("Added to your Wishlist");
    window.dispatchEvent(new Event("wishlist:changed"));
    return { added: result.added };
  }, [applyGuestProducts, guestIds, ids, isAuthenticated, mutate, products]);

  const add = useCallback(async (product: WishlistInputProduct) => {
    if (isInWishlist(product.id)) return;
    await toggle(product);
  }, [isInWishlist, toggle]);

  const remove = useCallback(async (productId: string) => {
    const id = String(productId || "").trim();
    if (!id) return;

    if (isAuthenticated) {
      const nextIds = removeWishlistId(ids, id);
      const nextProducts = products.filter((item) => item.id !== id);
      try {
        await mutate(
          async () => {
            const response = await fetch("/api/wishlist", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "set", ids: nextIds }),
            });
            if (!response.ok) {
              throw new Error(await getApiErrorMessage(response, "Unable to remove wishlist item."));
            }
            return (await response.json()) as WishlistApiResponse;
          },
          {
            optimisticData: { authenticated: true, items: nextIds, products: nextProducts },
            rollbackOnError: true,
            revalidate: false,
          }
        );
      } catch (error) {
        showErrorToast((error as Error).message || "Unable to remove wishlist item.");
        return;
      }
      window.dispatchEvent(new Event("wishlist:changed"));
      return;
    }

    const nextIds = removeWishlistId(guestIds, id);
    applyGuestProducts((current) => current.filter((item) => item.id !== id));
    hydratedGuestIdsRef.current = hydratedGuestIdsRef.current.filter((guestId) => guestId !== id);
    setGuestIds(nextIds);
    writeGuestWishlist(nextIds);
    window.dispatchEvent(new Event("wishlist:changed"));
  }, [applyGuestProducts, guestIds, ids, isAuthenticated, mutate, products]);

  const loading = isLoading || guestHydrating;

  const value = useMemo<WishlistContextValue>(
    () => ({ ids, products, count: ids.length, loading, isAuthenticated, isInWishlist, toggle, add, remove }),
    [add, ids, isAuthenticated, isInWishlist, loading, products, remove, toggle]
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) throw new Error("useWishlist must be used within WishlistProvider");
  return context;
}
