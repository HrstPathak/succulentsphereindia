import { resolveCollectionHandle } from "@/lib/productFilters";

export const DEFAULT_CATALOG_SORT = "featured" as const;

export const CATALOG_SORT_OPTIONS = [
  DEFAULT_CATALOG_SORT,
  "low-to-high",
  "high-to-low",
  "newest",
  "best-selling",
] as const;

export type CatalogSortValue = (typeof CATALOG_SORT_OPTIONS)[number];

export type CatalogPriceRange = {
  min: number;
  max: number;
};

export type CatalogFiltersState = {
  collections: string[];
  plantType: string[];
  careLevel: string[];
  potSize: string[];
  potMaterial: string[];
  availability: boolean;
  priceRange: CatalogPriceRange;
};

type QueryParamSource =
  | URLSearchParams
  | Record<string, string | string[] | undefined>;

type ParseCatalogQueryOptions = {
  defaultPage?: number;
  defaultSort?: CatalogSortValue;
  defaultPriceRange?: CatalogPriceRange;
};

type BuildCatalogBrowserSearchParamsOptions = {
  sort: CatalogSortValue;
  filters: CatalogFiltersState;
  page?: number;
  defaultSort?: CatalogSortValue;
  defaultPriceRange?: CatalogPriceRange;
};

type BuildCatalogApiSearchParamsOptions = {
  sort: CatalogSortValue;
  filters: CatalogFiltersState;
  page?: number;
  pageSize?: number;
  scopedCollection?: string;
  baseCollections?: string[];
  requiredTag?: string;
  enforcedPriceRange?: Partial<CatalogPriceRange> | null;
};

const EMPTY_PRICE_RANGE: CatalogPriceRange = { min: 0, max: 5000 };

function getFirstQueryValue(source: QueryParamSource, key: string): string | undefined {
  if (source instanceof URLSearchParams) {
    const value = source.get(key);
    return value === null ? undefined : value;
  }

  const value = source[key];
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : undefined;
  }
  return typeof value === "string" ? value : undefined;
}

function parseCsvParam(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseNumberParam(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function parseCatalogPageNumber(value: string | undefined, fallback = 1) {
  const parsed = Number(value || String(fallback));
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
}

export function normalizeCatalogSortValue(value: string | null | undefined, fallback: CatalogSortValue = DEFAULT_CATALOG_SORT): CatalogSortValue {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  switch (normalized) {
    case "price_asc":
    case "low-to-high":
      return "low-to-high";
    case "price_desc":
    case "high-to-low":
      return "high-to-low";
    case "newest":
      return "newest";
    case "best_selling":
    case "best-selling":
      return "best-selling";
    case "featured":
      return "featured";
    default:
      return fallback;
  }
}

export function toCatalogApiSortValue(sort: CatalogSortValue) {
  switch (sort) {
    case "low-to-high":
      return "price_asc";
    case "high-to-low":
      return "price_desc";
    case "best-selling":
      return "best_selling";
    case "newest":
      return "newest";
    case "featured":
    default:
      return "featured";
  }
}

export function parseCatalogQueryState(source: QueryParamSource, options: ParseCatalogQueryOptions = {}) {
  const defaultPriceRange = options.defaultPriceRange || EMPTY_PRICE_RANGE;
  const collection = resolveCollectionHandle(getFirstQueryValue(source, "collection") || "");

  return {
    page: parseCatalogPageNumber(getFirstQueryValue(source, "page"), options.defaultPage || 1),
    sort: normalizeCatalogSortValue(getFirstQueryValue(source, "sort"), options.defaultSort || DEFAULT_CATALOG_SORT),
    filters: {
      collections: collection ? [collection] : [],
      plantType: parseCsvParam(getFirstQueryValue(source, "plantType")),
      careLevel: parseCsvParam(getFirstQueryValue(source, "careLevel")),
      potSize: parseCsvParam(getFirstQueryValue(source, "potSize")),
      potMaterial: parseCsvParam(getFirstQueryValue(source, "potMaterial")),
      availability: String(getFirstQueryValue(source, "availability") || "").trim().toLowerCase() === "true",
      priceRange: {
        min: parseNumberParam(getFirstQueryValue(source, "minPrice"), defaultPriceRange.min),
        max: parseNumberParam(getFirstQueryValue(source, "maxPrice"), defaultPriceRange.max),
      },
    } satisfies CatalogFiltersState,
  };
}

export function normalizeCatalogFilters(
  filters: CatalogFiltersState,
  options: {
    scopedCollection?: string;
    enforcedPriceRange?: Partial<CatalogPriceRange> | null;
  } = {}
): CatalogFiltersState {
  const scopedCollection = resolveCollectionHandle(options.scopedCollection || "");
  const normalizedCollections = scopedCollection
    ? [scopedCollection]
    : filters.collections.map((value) => resolveCollectionHandle(value)).filter(Boolean).slice(0, 1);

  const rawMin = Number(filters.priceRange?.min ?? EMPTY_PRICE_RANGE.min);
  const rawMax = Number(filters.priceRange?.max ?? EMPTY_PRICE_RANGE.max);
  const enforcedMin = Number(options.enforcedPriceRange?.min ?? EMPTY_PRICE_RANGE.min);
  const enforcedMax = Number(options.enforcedPriceRange?.max ?? EMPTY_PRICE_RANGE.max);
  const safeMin = Number.isFinite(rawMin) ? rawMin : EMPTY_PRICE_RANGE.min;
  const safeMax = Number.isFinite(rawMax) ? rawMax : EMPTY_PRICE_RANGE.max;
  const boundedMin = Math.max(enforcedMin, Math.min(safeMin, safeMax));
  const boundedMax = Math.min(enforcedMax, Math.max(safeMin, safeMax));

  return {
    collections: normalizedCollections,
    plantType: Array.isArray(filters.plantType) ? filters.plantType.filter(Boolean) : [],
    careLevel: Array.isArray(filters.careLevel) ? filters.careLevel.filter(Boolean) : [],
    potSize: Array.isArray(filters.potSize) ? filters.potSize.filter(Boolean) : [],
    potMaterial: Array.isArray(filters.potMaterial) ? filters.potMaterial.filter(Boolean) : [],
    availability: Boolean(filters.availability),
    priceRange: {
      min: Math.min(boundedMin, boundedMax),
      max: Math.max(boundedMin, boundedMax),
    },
  };
}

export function buildCatalogBrowserSearchParams(options: BuildCatalogBrowserSearchParamsOptions) {
  const params = new URLSearchParams();
  const defaultSort = options.defaultSort || DEFAULT_CATALOG_SORT;
  const defaultPriceRange = options.defaultPriceRange || EMPTY_PRICE_RANGE;
  const normalizedFilters = normalizeCatalogFilters(options.filters);

  if (options.page && options.page > 1) {
    params.set("page", String(options.page));
  }
  if (options.sort !== defaultSort) {
    params.set("sort", options.sort);
  }
  if (normalizedFilters.collections[0]) {
    params.set("collection", normalizedFilters.collections[0]);
  }
  if (normalizedFilters.plantType.length > 0) {
    params.set("plantType", normalizedFilters.plantType.join(","));
  }
  if (normalizedFilters.careLevel.length > 0) {
    params.set("careLevel", normalizedFilters.careLevel.join(","));
  }
  if (normalizedFilters.potSize.length > 0) {
    params.set("potSize", normalizedFilters.potSize.join(","));
  }
  if (normalizedFilters.potMaterial.length > 0) {
    params.set("potMaterial", normalizedFilters.potMaterial.join(","));
  }
  if (normalizedFilters.availability) {
    params.set("availability", "true");
  }

  const safeDefaultMin = Number(defaultPriceRange.min);
  const safeDefaultMax = Number(defaultPriceRange.max);
  if (
    normalizedFilters.priceRange.min !== safeDefaultMin ||
    normalizedFilters.priceRange.max !== safeDefaultMax
  ) {
    params.set("minPrice", String(normalizedFilters.priceRange.min));
    params.set("maxPrice", String(normalizedFilters.priceRange.max));
  }

  return params;
}

export function buildCatalogApiSearchParams(options: BuildCatalogApiSearchParamsOptions) {
  const params = new URLSearchParams();
  const normalizedFilters = normalizeCatalogFilters(options.filters, {
    scopedCollection: options.scopedCollection,
    enforcedPriceRange: options.enforcedPriceRange,
  });
  const normalizedBaseCollections = (options.baseCollections || [])
    .map((value) => resolveCollectionHandle(value))
    .filter(Boolean);
  const pageSize = Math.max(1, options.pageSize || 20);
  const page = Math.max(1, options.page || 1);

  params.set("limit", String(pageSize));
  params.set("offset", String((page - 1) * pageSize));
  params.set("sort", toCatalogApiSortValue(options.sort));

  if (normalizedFilters.collections[0]) {
    params.set("collectionHandle", normalizedFilters.collections[0]);
  }
  if (normalizedBaseCollections.length > 0) {
    params.set("collections", normalizedBaseCollections.join(","));
  }
  if (options.requiredTag) {
    params.set("tag", options.requiredTag);
  }
  if (normalizedFilters.plantType.length > 0) {
    params.set("plantType", normalizedFilters.plantType.join(","));
  }
  if (normalizedFilters.careLevel.length > 0) {
    params.set("careLevel", normalizedFilters.careLevel.join(","));
  }
  if (normalizedFilters.potSize.length > 0) {
    params.set("potSize", normalizedFilters.potSize.join(","));
  }
  if (normalizedFilters.potMaterial.length > 0) {
    params.set("potMaterial", normalizedFilters.potMaterial.join(","));
  }
  if (normalizedFilters.availability) {
    params.set("availability", "true");
  }
  params.set("minPrice", String(normalizedFilters.priceRange.min));
  params.set("maxPrice", String(normalizedFilters.priceRange.max));

  return params;
}

export function hasCatalogQueryParams(source: QueryParamSource) {
  return [
    "sort",
    "collection",
    "plantType",
    "careLevel",
    "potSize",
    "potMaterial",
    "availability",
    "minPrice",
    "maxPrice",
  ].some((key) => {
    const value = getFirstQueryValue(source, key);
    return typeof value === "string" && value.trim().length > 0;
  });
}
