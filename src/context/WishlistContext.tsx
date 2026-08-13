"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import {
  clearGuestWishlist,
  normalizeWishlistIds,
  readGuestWishlist,
  removeWishlistId,
  toggleWishlistId,
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

async function fetchProductsByIds(ids: string[]) {
  if (!ids.length) return [];
  const response = await fetch("/api/wishlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "products", ids }),
  });
  if (!response.ok) return [];
  const payload = await response.json();
  return Array.isArray(payload?.products) ? (payload.products as WishlistProduct[]) : [];
}

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [guestIds, setGuestIds] = useState<string[]>([]);
  const [guestProducts, setGuestProducts] = useState<WishlistProduct[]>([]);
  const [mergedGuest, setMergedGuest] = useState(false);

  const { data, mutate, isLoading } = useSWR<WishlistApiResponse>("/api/wishlist", jsonFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 15000,
  });

  const isAuthenticated = Boolean(data?.authenticated);

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
      setGuestProducts([]);
      return;
    }
    fetchProductsByIds(guestIds).then((products) => setGuestProducts(products));
  }, [guestIds]);

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

  const isInWishlist = (productId: string) => ids.includes(String(productId || "").trim());

  async function toggle(product: WishlistInputProduct) {
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
    const nextProducts = result.added
      ? [product, ...guestProducts.filter((item) => item.id !== product.id)]
      : guestProducts.filter((item) => item.id !== product.id);

    setGuestIds(nextIds);
    setGuestProducts(nextProducts);
    writeGuestWishlist(nextIds);
    if (result.added) showSuccessToast("Added to your Wishlist");
    window.dispatchEvent(new Event("wishlist:changed"));
    return { added: result.added };
  }

  async function add(product: WishlistInputProduct) {
    if (isInWishlist(product.id)) return;
    await toggle(product);
  }

  async function remove(productId: string) {
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
    const nextProducts = guestProducts.filter((item) => item.id !== id);
    setGuestIds(nextIds);
    setGuestProducts(nextProducts);
    writeGuestWishlist(nextIds);
    window.dispatchEvent(new Event("wishlist:changed"));
  }

  const value: WishlistContextValue = {
    ids,
    products,
    count: ids.length,
    loading: isLoading,
    isAuthenticated,
    isInWishlist,
    toggle,
    add,
    remove,
  };

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) throw new Error("useWishlist must be used within WishlistProvider");
  return context;
}
