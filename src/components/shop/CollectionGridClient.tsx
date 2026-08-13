"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FilterDrawer from "./FilterDrawer";
import { useFilters } from "../../context/FilterContext";
import SortDropdown from "./SortDropdown";
import ProductCard from "./ProductCard";
import Pagination from "./Pagination";
import type { Product } from "../../data/mockProducts";
import { PRICE_MAX, PRICE_MIN } from "../../context/FilterContext";
import { resolveCollectionHandle } from "@/lib/productFilters";
import { useUrlQueryParams } from "@/hooks/useUrlQueryParams";
import {
  DEFAULT_CATALOG_SORT,
  buildCatalogApiSearchParams,
  buildCatalogBrowserSearchParams,
  normalizeCatalogFilters,
  parseCatalogQueryState,
  type CatalogFiltersState,
  type CatalogSortValue,
} from "@/lib/catalogQueryParams";

type FilterFacets = {
  plantGenus: string[];
  careLevel: string[];
  potSize: string[];
  potMaterial: string[];
  priceRange: { min: number; max: number };
};

const DEFAULT_FACETS: FilterFacets = {
  plantGenus: [],
  careLevel: ["Beginner", "Advanced"],
  potSize: [],
  potMaterial: ["Plastic", "Ceramic"],
  priceRange: { min: PRICE_MIN, max: PRICE_MAX },
};

function mapProducts(items: any[]): Product[] {
  return (items || []).map((product: any) => ({
    ...product,
    price: String(product.price ?? "0.00"),
    compareAtPrice: product.compareAtPrice ?? null,
    image: product.image || "/assets/product-1.jpg",
    badge: product.badge || "",
    rating: typeof product.rating === "number" ? product.rating : undefined,
    reviewCount: typeof product.reviewCount === "number" ? product.reviewCount : 0,
  })) as Product[];
}

export default function CollectionGridClient({
  products,
  collectionHandle,
  baseCollections = [],
  requiredTag,
  productBasePath = "collections",
  enforcedPriceRange,
  resetFiltersOnMount: _resetFiltersOnMount = false,
  page = 1,
  totalPages = 1,
  pageSize = 20,
  defaultSort = DEFAULT_CATALOG_SORT,
}: {
  products: Product[];
  collectionHandle?: string;
  baseCollections?: string[];
  requiredTag?: string;
  productBasePath?: "collections" | "products";
  enforcedPriceRange?: {
    min?: number;
    max?: number;
  };
  resetFiltersOnMount?: boolean;
  page?: number;
  totalPages?: number;
  pageSize?: number;
  defaultSort?: CatalogSortValue;
}) {
  const [sort, setSort] = useState<CatalogSortValue>(defaultSort);
  const [displayProducts, setDisplayProducts] = useState<Product[]>(products);
  const [resolvedTotalPages, setResolvedTotalPages] = useState(Math.max(1, totalPages));
  const [loading, setLoading] = useState(false);
  const [facets, setFacets] = useState<FilterFacets>(DEFAULT_FACETS);
  const [queryStateReady, setQueryStateReady] = useState(false);
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRequestIdRef = useRef(0);
  const { filters, setFilters } = useFilters();
  const { searchParams, setQueryParams } = useUrlQueryParams();

  const baseCollectionsKey = useMemo(
    () => (Array.isArray(baseCollections) ? baseCollections.map((collection) => resolveCollectionHandle(collection)).filter(Boolean).join(",") : ""),
    [baseCollections]
  );
  const normalizedBaseCollections = useMemo(
    () => (baseCollectionsKey ? baseCollectionsKey.split(",") : []),
    [baseCollectionsKey]
  );
  const selectedCollectionsKey = useMemo(() => filters.collections.join(","), [filters.collections]);
  const scopedCollection = collectionHandle ? resolveCollectionHandle(collectionHandle) : "";
  const hideCollections = Boolean(scopedCollection);
  const hideComboTag = productBasePath === "products" && !collectionHandle && !requiredTag;

  const normalizedEnforcedPriceRange = useMemo(() => {
    if (!enforcedPriceRange) return null;
    const rawMin = Number(enforcedPriceRange.min ?? PRICE_MIN);
    const rawMax = Number(enforcedPriceRange.max ?? PRICE_MAX);
    const safeMin = Number.isFinite(rawMin) ? Math.max(PRICE_MIN, rawMin) : PRICE_MIN;
    const safeMaxBase = Number.isFinite(rawMax) ? rawMax : PRICE_MAX;
    const safeMax = Math.max(safeMin, Math.min(PRICE_MAX, safeMaxBase));
    return { min: safeMin, max: safeMax };
  }, [enforcedPriceRange]);

  const normalizedProducts = useMemo(
    () =>
      normalizedEnforcedPriceRange
        ? products.filter((product) => {
            const priceValue = Number(product?.price ?? 0);
            return priceValue >= normalizedEnforcedPriceRange.min && priceValue <= normalizedEnforcedPriceRange.max;
          })
        : products,
    [products, normalizedEnforcedPriceRange]
  );

  const effectivePriceRangeBounds = useMemo(() => {
    const minBase = Math.max(PRICE_MIN, facets.priceRange.min);
    const maxBase = Math.min(PRICE_MAX, facets.priceRange.max);

    if (!normalizedEnforcedPriceRange) {
      return {
        min: minBase,
        max: Math.max(minBase, maxBase),
      };
    }

    const min = Math.max(minBase, normalizedEnforcedPriceRange.min);
    const max = Math.max(min, Math.min(maxBase, normalizedEnforcedPriceRange.max));
    return { min, max };
  }, [facets.priceRange.max, facets.priceRange.min, normalizedEnforcedPriceRange]);

  const parsedQueryState = useMemo(
    () =>
      parseCatalogQueryState(searchParams, {
        defaultPage: page,
        defaultSort,
        defaultPriceRange: normalizedEnforcedPriceRange || { min: PRICE_MIN, max: PRICE_MAX },
      }),
    [defaultSort, normalizedEnforcedPriceRange, page, searchParams]
  );

  const currentPage = parsedQueryState.page;
  const desiredFiltersFromQuery = useMemo(
    () =>
      normalizeCatalogFilters(parsedQueryState.filters, {
        scopedCollection,
        enforcedPriceRange: normalizedEnforcedPriceRange,
      }),
    [normalizedEnforcedPriceRange, parsedQueryState.filters, scopedCollection]
  );

  const serializableFilters = useMemo(
    () =>
      normalizeCatalogFilters(
        {
          ...filters,
          collections: hideCollections ? [] : filters.collections,
        },
        {
          enforcedPriceRange: effectivePriceRangeBounds,
        }
      ),
    [effectivePriceRangeBounds, filters, hideCollections]
  );

  const paginationQueryString = useMemo(
    () =>
      buildCatalogBrowserSearchParams({
        sort,
        filters: serializableFilters,
        page: currentPage,
        defaultSort,
        defaultPriceRange: effectivePriceRangeBounds,
      }).toString(),
    [currentPage, defaultSort, effectivePriceRangeBounds, serializableFilters, sort]
  );

  const syncUrlState = useCallback(
    (nextSort: CatalogSortValue, nextFilters: CatalogFiltersState, nextPage = 1) => {
      const nextParams = buildCatalogBrowserSearchParams({
        sort: nextSort,
        filters: normalizeCatalogFilters(
          {
            ...nextFilters,
            collections: hideCollections ? [] : nextFilters.collections,
          },
          { enforcedPriceRange: effectivePriceRangeBounds }
        ),
        page: nextPage,
        defaultSort,
        defaultPriceRange: effectivePriceRangeBounds,
      });

      setQueryParams({
        page: nextParams.get("page") || null,
        sort: nextParams.get("sort") || null,
        collection: nextParams.get("collection") || null,
        plantType: nextParams.get("plantType") || null,
        careLevel: nextParams.get("careLevel") || null,
        potSize: nextParams.get("potSize") || null,
        potMaterial: nextParams.get("potMaterial") || null,
        availability: nextParams.get("availability") || null,
        minPrice: nextParams.get("minPrice") || null,
        maxPrice: nextParams.get("maxPrice") || null,
      });
    },
    [defaultSort, effectivePriceRangeBounds, hideCollections, setQueryParams]
  );

  useEffect(() => {
    setDisplayProducts(normalizedProducts);
    setResolvedTotalPages(Math.max(1, totalPages));
  }, [normalizedProducts, totalPages]);

  useEffect(() => {
    return () => {
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadFacets = async () => {
      try {
        const params = new URLSearchParams();
        if (scopedCollection) {
          params.set("scope", "collection");
          params.set("collectionHandle", scopedCollection);
        } else {
          params.set("scope", "shop");
          if (filters.collections.length > 0) {
            params.set("collections", filters.collections.join(","));
          } else if (normalizedBaseCollections.length > 0) {
            params.set("collections", normalizedBaseCollections.join(","));
          }
        }
        if (requiredTag) {
          params.set("tag", requiredTag);
        }

        const res = await fetch(`/api/filters?${params.toString()}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to fetch facets");

        const json = await res.json();
        const nextFacets = json?.facets || {};
        const nextMin = Number(nextFacets?.priceRange?.min ?? PRICE_MIN);
        const nextMax = Number(nextFacets?.priceRange?.max ?? PRICE_MAX);
        const constrainedMin = normalizedEnforcedPriceRange
          ? Math.max(nextMin, normalizedEnforcedPriceRange.min)
          : nextMin;
        const constrainedMaxBase = normalizedEnforcedPriceRange
          ? Math.min(nextMax, normalizedEnforcedPriceRange.max)
          : nextMax;
        const constrainedMax = Math.max(constrainedMin, constrainedMaxBase);
        if (!active) return;

        setFacets({
          plantGenus: Array.isArray(nextFacets.plantGenus) ? nextFacets.plantGenus : [],
          careLevel: Array.isArray(nextFacets.careLevel) && nextFacets.careLevel.length > 0 ? nextFacets.careLevel : DEFAULT_FACETS.careLevel,
          potSize: Array.isArray(nextFacets.potSize) ? nextFacets.potSize : [],
          potMaterial: Array.isArray(nextFacets.potMaterial) && nextFacets.potMaterial.length > 0 ? nextFacets.potMaterial : DEFAULT_FACETS.potMaterial,
          priceRange: {
            min: constrainedMin,
            max: constrainedMax,
          },
        });
      } catch {
        if (!active) return;
        setFacets(DEFAULT_FACETS);
      }
    };

    loadFacets();
    return () => {
      active = false;
    };
  }, [baseCollectionsKey, normalizedBaseCollections, normalizedEnforcedPriceRange, requiredTag, scopedCollection, selectedCollectionsKey]);

  useEffect(() => {
    const min = effectivePriceRangeBounds.min;
    const max = effectivePriceRangeBounds.max;

    if (
      filters.priceRange.min >= min &&
      filters.priceRange.max <= max &&
      filters.priceRange.min <= filters.priceRange.max
    ) {
      return;
    }

    setFilters({
      ...filters,
      priceRange: {
        min,
        max,
      },
    });
  }, [effectivePriceRangeBounds.max, effectivePriceRangeBounds.min, filters, setFilters]);

  const queryStateKey = useMemo(
    () => JSON.stringify({ sort: parsedQueryState.sort, filters: desiredFiltersFromQuery }),
    [desiredFiltersFromQuery, parsedQueryState.sort]
  );

  useEffect(() => {
    setQueryStateReady(false);
    setSort(parsedQueryState.sort);
    setFilters(desiredFiltersFromQuery);
    setQueryStateReady(true);
  }, [desiredFiltersFromQuery, parsedQueryState.sort, queryStateKey, setFilters]);

  const doSearch = useCallback(async () => {
    const requestId = ++activeRequestIdRef.current;
    if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);

    loadingTimerRef.current = setTimeout(() => {
      if (requestId === activeRequestIdRef.current) setLoading(true);
    }, 180);

    try {
      const params = buildCatalogApiSearchParams({
        sort,
        filters,
        page: currentPage,
        pageSize,
        scopedCollection,
        baseCollections: normalizedBaseCollections,
        requiredTag,
        enforcedPriceRange: normalizedEnforcedPriceRange,
      });

      const res = await fetch(`/api/products?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Product fetch failed");

      const json = await res.json();
      if (requestId !== activeRequestIdRef.current) return;

      setResolvedTotalPages(Math.max(1, Number(json?.pagination?.totalPages) || 1));
      setDisplayProducts(mapProducts(json.results));
    } catch {
      if (requestId !== activeRequestIdRef.current) return;
      setDisplayProducts(normalizedProducts);
      setResolvedTotalPages(Math.max(1, totalPages));
    } finally {
      if (requestId === activeRequestIdRef.current) {
        if (loadingTimerRef.current) {
          clearTimeout(loadingTimerRef.current);
          loadingTimerRef.current = null;
        }
        setLoading(false);
      }
    }
  }, [
    currentPage,
    filters,
    normalizedBaseCollections,
    normalizedEnforcedPriceRange,
    normalizedProducts,
    pageSize,
    requiredTag,
    scopedCollection,
    sort,
    totalPages,
  ]);

  const isDefaultState = useMemo(() => {
    return (
      sort === defaultSort &&
      !filters.plantType.length &&
      !filters.careLevel.length &&
      !filters.potSize.length &&
      !filters.potMaterial.length &&
      !filters.availability &&
      filters.priceRange.min === effectivePriceRangeBounds.min &&
      filters.priceRange.max === effectivePriceRangeBounds.max
    );
  }, [defaultSort, effectivePriceRangeBounds.max, effectivePriceRangeBounds.min, filters, sort]);

  useEffect(() => {
    if (!queryStateReady) return;

    if (isDefaultState && currentPage === page) {
      setDisplayProducts(normalizedProducts);
      setResolvedTotalPages(Math.max(1, totalPages));
      return;
    }

    doSearch();
  }, [currentPage, doSearch, isDefaultState, normalizedProducts, page, queryStateReady, totalPages]);

  const handleFiltersChange = useCallback(
    (nextFilters: CatalogFiltersState) => {
      setFilters(nextFilters);
      syncUrlState(sort, nextFilters, 1);
    },
    [setFilters, sort, syncUrlState]
  );

  const handleSortChange = useCallback(
    (nextSort: CatalogSortValue) => {
      setSort(nextSort);
      syncUrlState(nextSort, filters, 1);
    },
    [filters, syncUrlState]
  );
  return (
    <>
      <div
        className="sticky bg-white/95 dark:bg-gray-900/95 border-b border-gray-200 dark:border-gray-800 py-4 z-30 shadow-sm backdrop-blur rounded-xl"
        style={{ top: "var(--ss-header-offset, 64px)" }}
      >
        <div className="flex items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-3">
            <FilterDrawer
              filters={filters}
              onFiltersChange={handleFiltersChange}
              facets={facets}
              hideCollections={hideCollections}
              forcedCollection={scopedCollection || null}
            />
          </div>
          <div className="flex items-center gap-3">
            <SortDropdown value={sort} onChange={handleSortChange} />
          </div>
        </div>
      </div>

      {loading && (
        <div className="px-4 pt-2 text-xs text-gray-500 dark:text-gray-400" aria-live="polite">
          Loading products...
        </div>
      )}

      <div className="mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 pb-12 items-stretch auto-rows-fr">
        {displayProducts.map((product) => (
          <div key={product.id} className="h-full">
            <ProductCard product={product} collectionHandle={collectionHandle} productBasePath={productBasePath} hideComboTag={hideComboTag} />
          </div>
        ))}
      </div>

      <Pagination page={currentPage} total={Math.max(1, resolvedTotalPages)} queryString={paginationQueryString} />
    </>
  );
}
