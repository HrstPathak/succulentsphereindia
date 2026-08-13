import { NextResponse } from "next/server";
import { fetchAllProductsList } from "../../../lib/commerce";
import {
  inferFilterCareLevel,
  inferPlantGenus,
  inferPotMaterial,
  inferPotSize,
  productMatchesCollection,
  resolveCollectionHandle,
} from "../../../lib/productFilters";
import { normalizeCatalogSortValue, toCatalogApiSortValue } from "@/lib/catalogQueryParams";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
function normalizeTag(value: string) {
  return value.trim().toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ");
}

function hasPriorityTag(tags: string[] | undefined, wanted: string) {
  if (!Array.isArray(tags) || tags.length === 0) return false;
  const wantedTag = normalizeTag(wanted);
  return tags.some((tag) => normalizeTag(String(tag)) === wantedTag);
}

function sortByCatalogTags(items: any[], sort: string | null) {
  const byNewestDate = (a: any, b: any) =>
    new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  const byLowPrice = (a: any, b: any) => Number(a.price || 0) - Number(b.price || 0);
  const byHighPrice = (a: any, b: any) => Number(b.price || 0) - Number(a.price || 0);

  if (sort === "price_asc") {
    return [...items].sort(byLowPrice);
  }

  if (sort === "price_desc") {
    return [...items].sort(byHighPrice);
  }

  if (sort === "best_selling") {
    const bestSelling = items.filter((item) => hasPriorityTag(item.tags, "best selling")).sort(byNewestDate);
    const rest = items.filter((item) => !hasPriorityTag(item.tags, "best selling")).sort(byNewestDate);
    return [...bestSelling, ...rest];
  }

  if (sort === "newest") {
    const newest = items
      .filter((item) => hasPriorityTag(item.tags, "newest"))
      .sort(byNewestDate);
    const rest = items.filter((item) => !hasPriorityTag(item.tags, "newest")).sort(byNewestDate);
    return [...newest, ...rest];
  }

  return [...items].sort(byNewestDate);
}

function toSortConfig(sort: string | null) {
  switch (sort) {
    case "price_asc":
      return { sortKey: "PRICE" as const, reverse: false };
    case "price_desc":
      return { sortKey: "PRICE" as const, reverse: true };
    case "newest":
      return { sortKey: "CREATED_AT" as const, reverse: true };
    case "best_selling":
      return { sortKey: "BEST_SELLING" as const, reverse: false };
    case "featured":
    default:
      return { sortKey: "BEST_SELLING" as const, reverse: false };
  }
}

function toSafeNumber(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.floor(parsed));
}

function hasTag(tags: string[] | undefined, wanted: string) {
  if (!Array.isArray(tags) || tags.length === 0) return false;
  const wantedTag = normalizeTag(wanted);
  return tags.some((tag) => normalizeTag(String(tag)) === wantedTag);
}

function parseCsv(value: string | null) {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(MAX_LIMIT, Math.max(1, toSafeNumber(searchParams.get("limit"), DEFAULT_LIMIT)));
    const offset = toSafeNumber(searchParams.get("offset"), 0);
    const sort = toCatalogApiSortValue(normalizeCatalogSortValue(searchParams.get("sort")));
    const collectionHandleParam = searchParams.get("collectionHandle") || "";
    const collectionsParam = parseCsv(searchParams.get("collections")).map((value) => resolveCollectionHandle(value));
    const tagParam = (searchParams.get("tag") || "").trim();
    const plantTypeParam = parseCsv(searchParams.get("plantType"));
    const careLevelParam = parseCsv(searchParams.get("careLevel"));
    const potSizeParam = parseCsv(searchParams.get("potSize"));
    const potMaterialParam = parseCsv(searchParams.get("potMaterial"));
    const availabilityParam = searchParams.get("availability");
    const minPriceParam = searchParams.get("minPrice");
    const maxPriceParam = searchParams.get("maxPrice");
    const scopedCollection = collectionHandleParam ? resolveCollectionHandle(collectionHandleParam) : "";
    const rawMinPrice = Number(minPriceParam ?? 0);
    const rawMaxPrice = Number(maxPriceParam ?? Number.MAX_SAFE_INTEGER);
    const safeMinPrice = Number.isFinite(rawMinPrice) ? Math.max(0, rawMinPrice) : 0;
    const safeMaxPriceBase = Number.isFinite(rawMaxPrice) ? rawMaxPrice : Number.MAX_SAFE_INTEGER;
    const safeMaxPrice = Math.max(safeMinPrice, safeMaxPriceBase);
    const plantTypes = plantTypeParam.map((value) => value.toLowerCase());
    const careLevels = careLevelParam.map((value) => value.toLowerCase());
    const potSizes = potSizeParam.map((value) => value.toLowerCase());
    const potMaterials = potMaterialParam.map((value) => value.toLowerCase());
    const inStockOnly = availabilityParam === "true";
    const { sortKey, reverse } = toSortConfig(sort);
    const items = await fetchAllProductsList({ sortKey, reverse });
    const baseScoped =
      collectionsParam.length > 0
        ? items.filter((item: any) => collectionsParam.some((collection) => productMatchesCollection(item, collection)))
        : items;
    const collectionScoped = scopedCollection ? baseScoped.filter((item: any) => productMatchesCollection(item, scopedCollection)) : baseScoped;
    const scopedItems = tagParam ? collectionScoped.filter((item: any) => hasTag(item.tags, tagParam)) : collectionScoped;
    const filteredItems = scopedItems
      .filter((item: any) => {
        if (plantTypes.length === 0) return true;
        return plantTypes.includes((inferPlantGenus(item) || "").toLowerCase());
      })
      .filter((item: any) => {
        if (careLevels.length === 0) return true;
        return careLevels.includes(inferFilterCareLevel(item).toLowerCase());
      })
      .filter((item: any) => {
        if (potSizes.length === 0) return true;
        return potSizes.includes((inferPotSize(item) || "").toLowerCase());
      })
      .filter((item: any) => {
        if (potMaterials.length === 0) return true;
        return potMaterials.includes((inferPotMaterial(item) || "").toLowerCase());
      })
      .filter((item: any) => {
        if (!inStockOnly) return true;
        return Boolean(item?.available);
      })
      .filter((item: any) => {
        const priceValue = Number(item?.price ?? 0);
        return priceValue >= safeMinPrice && priceValue <= safeMaxPrice;
      });
    const sortedItems = sortByCatalogTags(filteredItems, sort);
    const shouldPushPotsToEnd = !scopedCollection && collectionsParam.length === 0 && !tagParam;
    const orderedItems = shouldPushPotsToEnd
      ? [
          ...sortedItems.filter((item) => !productMatchesCollection(item, "pots")),
          ...sortedItems.filter((item) => productMatchesCollection(item, "pots")),
        ]
      : sortedItems;
    const results = orderedItems.slice(offset, offset + limit);
    const hasMore = orderedItems.length > offset + limit;
    const total = orderedItems.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const page = Math.floor(offset / limit) + 1;

    return NextResponse.json({
      results,
      pagination: {
        limit,
        offset,
        page,
        total,
        totalPages,
        hasMore,
      },
    });
  } catch (error) {
    return NextResponse.json({ results: [], error: (error as Error).message }, { status: 500 });
  }
}
