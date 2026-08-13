import { NextResponse } from "next/server";
import { fetchAllProductsList, fetchProductsByQuery } from "../../../lib/commerce";
import { mockProducts } from "../../../data/mockProducts";
import {
  inferFilterCareLevel,
  inferPlantGenus,
  inferPotMaterial,
  inferPotSize,
  productMatchesCollection,
  resolveCollectionHandle,
} from "../../../lib/productFilters";
import { getReviewStats, parseProductReviews } from "../../../lib/reviews";
import { normalizeCatalogSortValue, toCatalogApiSortValue } from "@/lib/catalogQueryParams";

const PRICE_MIN = 0;
const PRICE_MAX = 5000;

const CARE_LEVELS = ["beginner", "intermediate", "advanced"] as const;
function parseCsvParam(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function parseOptionalNumber(value: string | null, fallback: number) {
  if (value === null) return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function escapeSearchValue(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`;
}

function toSortConfig(sort: string) {
  switch (sort) {
    case "price_asc":
      return { sortKey: "PRICE" as const, reverse: false };
    case "price_desc":
      return { sortKey: "PRICE" as const, reverse: true };
    case "newest":
      return { sortKey: "CREATED_AT" as const, reverse: true };
    case "best_selling":
      return { sortKey: "BEST_SELLING" as const, reverse: false };
    default:
      return { sortKey: "BEST_SELLING" as const, reverse: false };
  }
}

function normalizeTag(value: string) {
  return value.trim().toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ");
}

function hasPriorityTag(tags: string[] | undefined, wanted: string) {
  if (!Array.isArray(tags) || tags.length === 0) return false;
  const wantedTag = normalizeTag(wanted);
  return tags.some((tag) => normalizeTag(String(tag)) === wantedTag);
}

function sortByTagPriority(items: any[], sort: string) {
  if (sort === "best_selling") {
    const priority = items.filter((item) => hasPriorityTag(item.tags, "best selling"));
    const rest = items.filter((item) => !hasPriorityTag(item.tags, "best selling"));
    return [...priority, ...rest];
  }

  if (sort === "newest") {
    const priority = items
      .filter((item) => hasPriorityTag(item.tags, "newest"))
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    const rest = items.filter((item) => !hasPriorityTag(item.tags, "newest"));
    return [...priority, ...rest];
  }

  return items;
}

function getCareLevelFromTags(tags: string[] = []): string | null {
  const match = tags.find((tag) => CARE_LEVELS.includes(tag.toLowerCase() as (typeof CARE_LEVELS)[number]));
  return match ?? null;
}

function hasTag(tags: string[] | undefined, wanted: string) {
  if (!Array.isArray(tags) || tags.length === 0) return false;
  const normalizedWanted = wanted.trim().toLowerCase();
  if (!normalizedWanted) return true;
  return tags.some((tag) => String(tag || "").trim().toLowerCase() === normalizedWanted);
}

function sortMockProducts(products: typeof mockProducts, sort: string) {
  const items = [...products];
  switch (sort) {
    case "price_asc":
      return items.sort((a, b) => Number(a.price) - Number(b.price));
    case "price_desc":
      return items.sort((a, b) => Number(b.price) - Number(a.price));
    case "newest":
      return sortByTagPriority(items, "newest");
    case "best_selling":
      return sortByTagPriority(items, "best_selling");
    default:
      return items;
  }
}

function includesQuery(item: any, query: string) {
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  const haystack = normalize(
    [
      item?.title || "",
      item?.handle || "",
      item?.type || item?.productType || "",
      ...(Array.isArray(item?.tags) ? item.tags : []),
    ].join(" ")
  );

  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return true;
  if (haystack.includes(normalizedQuery)) return true;

  const tokens = normalizedQuery.split(" ").filter((token) => token.length >= 2);
  if (tokens.length === 0) return false;
  return tokens.every((token) => haystack.includes(token));
}

function getHonestReviewSummary(node: any) {
  const reviews = Array.isArray(node?.reviews) ? node.reviews : parseProductReviews(node?.reviewsMetafield?.value);
  const stats = getReviewStats(reviews);
  return {
    rating: stats.reviewCount > 0 ? stats.averageRating : undefined,
    reviewCount: stats.reviewCount,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const sort = toCatalogApiSortValue(normalizeCatalogSortValue(searchParams.get("sort")));
  const limit = Number(searchParams.get("limit") || "6");
  const offsetParam = searchParams.get("offset");
  const plantTypeParam = searchParams.get("plantType");
  const careLevelParam = searchParams.get("careLevel");
  const collectionParam = searchParams.get("collection");
  const collectionsParam = parseCsvParam(searchParams.get("collections")).map((value) => resolveCollectionHandle(value));
  const requiredTagParam = (searchParams.get("requiredTag") || "").trim();
  const potSizeParam = searchParams.get("potSize");
  const potMaterialParam = searchParams.get("potMaterial");
  const availabilityParam = searchParams.get("availability");
  const minPriceParam = searchParams.get("minPrice");
  const maxPriceParam = searchParams.get("maxPrice");

  const plantTypes = parseCsvParam(plantTypeParam);
  const careLevels = parseCsvParam(careLevelParam);
  const potSizes = parseCsvParam(potSizeParam);
  const potMaterials = parseCsvParam(potMaterialParam);
  const selectedCollection = resolveCollectionHandle(collectionParam || "");
  const inStockOnly = availabilityParam === "true";
  const minPrice = parseOptionalNumber(minPriceParam, PRICE_MIN);
  const maxPrice = parseOptionalNumber(maxPriceParam, PRICE_MAX);
  const safeMinPrice = Math.max(PRICE_MIN, Math.min(minPrice, maxPrice));
  const safeMaxPrice = Math.min(PRICE_MAX, Math.max(minPrice, maxPrice));
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 50)) : 6;
  const safeOffset = Number.isFinite(Number(offsetParam)) ? Math.max(0, Number(offsetParam)) : 0;

  const searchTerms: string[] = [];
  if (q) searchTerms.push(q);

  if (plantTypes.length > 0) {
    searchTerms.push(`(${plantTypes.map((t) => `product_type:${escapeSearchValue(t)}`).join(" OR ")})`);
  }

  if (inStockOnly) {
    searchTerms.push("available_for_sale:true");
  }

  const searchQuery = searchTerms.join(" AND ");
  const { sortKey, reverse } = toSortConfig(sort);

  const buildMockResults = () => {
    const ql = q.toLowerCase();
    let results: any[] = mockProducts
      .filter((p) => p.title.toLowerCase().includes(ql) || (p.handle || "").toLowerCase().includes(ql))
      .slice(0, safeLimit);

    if (plantTypes.length > 0) {
      const normalized = plantTypes.map((t) => t.toLowerCase());
      results = results.filter((p: any) => normalized.includes((inferPlantGenus(p) || "").toLowerCase()));
    }
    if (careLevels.length > 0) {
      const normalized = careLevels.map((c) => c.toLowerCase());
      results = results.filter((p) => normalized.includes(inferFilterCareLevel(p).toLowerCase()));
    }
    if (potSizes.length > 0) {
      const normalized = potSizes.map((s) => s.toLowerCase());
      results = results.filter((p) => normalized.includes((inferPotSize(p) || "").toLowerCase()));
    }
    if (potMaterials.length > 0) {
      const normalized = potMaterials.map((m) => m.toLowerCase());
      results = results.filter((p) => normalized.includes((inferPotMaterial(p) || "").toLowerCase()));
    }
    if (selectedCollection) {
      results = results.filter((p) => productMatchesCollection(p, selectedCollection));
    }
    if (collectionsParam.length > 0) {
      results = results.filter((p) => collectionsParam.some((collection) => productMatchesCollection(p, collection)));
    }
    if (requiredTagParam) {
      results = results.filter((p: any) => hasTag(p.tags, requiredTagParam));
    }
    if (inStockOnly) {
      results = results.filter((p) => p.badge !== "Out of Stock" && p.badge !== "Sold Out");
    }
    results = results.filter((p) => {
      const priceValue = Number(p.price ?? 0);
      return priceValue >= safeMinPrice && priceValue <= safeMaxPrice;
    });

    results = sortMockProducts(results, sort);
    const total = results.length;
    const pagedResults = results.slice(safeOffset, safeOffset + safeLimit).map((p) => ({
      id: p.id,
      title: p.title,
      handle: p.handle,
      price: p.price,
      compareAtPrice: (p as { compareAtPrice?: string | null }).compareAtPrice ?? null,
      currency: p.currency,
      image: p.image,
      imageAlt: p.title,
      badge: p.badge,
      rating: p.rating,
      reviewCount: typeof p.reviewCount === "number" ? p.reviewCount : 0,
      availability: p.availability,
    }));
    return {
      results: pagedResults,
      pagination: {
        limit: safeLimit,
        offset: safeOffset,
        page: Math.floor(safeOffset / safeLimit) + 1,
        total,
        totalPages: Math.max(1, Math.ceil(total / safeLimit)),
        hasMore: safeOffset + safeLimit < total,
      },
    };
  };

  try {
    {
      const hasSearchTerm = Boolean(q);
      let results: any[] = [];

      const mapProductResult = (node: any) => {
        const tags = Array.isArray(node.tags) ? node.tags : [];
        const careLevel = node.metafield?.value || getCareLevelFromTags(tags) || "";
        const { rating, reviewCount } = getHonestReviewSummary(node);
        const variantNode = node.variants?.edges?.[0]?.node;
        const price = variantNode?.price?.amount ?? variantNode?.priceV2?.amount ?? node.price ?? "0.00";
        const currency = variantNode?.price?.currencyCode ?? variantNode?.priceV2?.currencyCode ?? node.currency ?? "USD";
        const compareAtPrice = variantNode?.compareAtPrice?.amount ?? null;
        const quantity = typeof variantNode?.quantityAvailable === "number" ? variantNode.quantityAvailable : undefined;
        const availableFlag = Boolean(node.availableForSale ?? node.available);
        const isOutOfStock =
          typeof quantity === "number" ? quantity <= 0 && availableFlag === false : availableFlag === false;
        const available = !isOutOfStock;
        const isBestSeller = hasTag(tags, "best selling") || hasTag(tags, "best seller");
        return {
          id: node.id,
          title: node.title,
          handle: node.handle,
          type: node.productType || node.type || "General",
          careLevel,
          plantGenus: node.plantGenusMetafield?.value || node.plantGenus || "",
          potSize: node.potSizeMetafield?.value || node.potSize || "",
          potMaterial: node.potMaterialMetafield?.value || node.potMaterial || "",
          description: node.description || "",
          collections: Array.isArray(node.collections?.edges)
            ? node.collections.edges
                .map((edge: any) => String(edge?.node?.handle || "").trim())
                .filter(Boolean)
            : Array.isArray(node.collections)
              ? node.collections
              : [],
          tags,
          price,
          compareAtPrice: compareAtPrice ? String(compareAtPrice) : null,
          currency,
          quantity,
          image: node.images?.edges?.[0]?.node?.url ?? node.image ?? "/assets/product-1.jpg",
          imageAlt: node.images?.edges?.[0]?.node?.altText ?? node.imageAlt ?? node.title,
          available,
          createdAt: node.createdAt ?? "",
          badge: isOutOfStock ? "Sold Out" : isBestSeller ? "Best Seller" : "",
          rating,
          reviewCount,
        };
      };

      try {
        if (hasSearchTerm) {
          const first = Math.min(250, safeOffset + safeLimit);
          const searched = await fetchProductsByQuery(searchQuery, { first, sortKey, reverse });
          const mapped = (searched?.edges || []).map((e: any) => mapProductResult(e.node));
          if (mapped.length > 0) {
            results = mapped;
          } else {
            const fallbackList = await fetchAllProductsList({ sortKey, reverse });
            results = fallbackList
              .map((item: any) => mapProductResult(item))
              .filter((item: any) => includesQuery(item, q));
          }
        } else {
          results = (await fetchAllProductsList({ sortKey, reverse })).map((p: any) => mapProductResult(p));
        }
      } catch {
        const fallback = await fetchAllProductsList({ sortKey, reverse });
        results = fallback
          .map((item: any) => mapProductResult(item))
          .filter((item: any) => (hasSearchTerm ? includesQuery(item, q) : true));
      }

      if (plantTypes.length > 0) {
        const normalized = plantTypes.map((t) => t.toLowerCase());
        results = results.filter((p) => normalized.includes((inferPlantGenus(p) || "").toLowerCase()));
      }
      if (careLevels.length > 0) {
        const normalized = careLevels.map((c) => c.toLowerCase());
        results = results.filter((p) => normalized.includes(inferFilterCareLevel(p).toLowerCase()));
      }
      if (potSizes.length > 0) {
        const normalized = potSizes.map((s) => s.toLowerCase());
        results = results.filter((p) => normalized.includes((inferPotSize(p) || "").toLowerCase()));
      }
      if (potMaterials.length > 0) {
        const normalized = potMaterials.map((m) => m.toLowerCase());
        results = results.filter((p) => normalized.includes((inferPotMaterial(p) || "").toLowerCase()));
      }
      if (selectedCollection) {
        results = results.filter((p) => productMatchesCollection(p, selectedCollection));
      }
      if (collectionsParam.length > 0) {
        results = results.filter((p) => collectionsParam.some((collection) => productMatchesCollection(p, collection)));
      }
      if (requiredTagParam) {
        results = results.filter((p: any) => hasTag(p.tags, requiredTagParam));
      }
      if (inStockOnly) {
        results = results.filter((p) => p.available);
      }
      results = results.filter((p) => {
        const priceValue = Number(p.price ?? 0);
        return priceValue >= safeMinPrice && priceValue <= safeMaxPrice;
      });
      results = sortByTagPriority(results, sort);

      const total = results.length;
      return NextResponse.json({
        results: results.slice(safeOffset, safeOffset + safeLimit).map((r) => ({
          id: r.id,
          title: r.title,
          handle: r.handle,
          price: r.price,
          compareAtPrice: r.compareAtPrice ?? null,
          currency: r.currency,
          image: r.image,
          imageAlt: r.imageAlt || r.title,
          badge: r.badge,
          rating: r.rating,
          reviewCount: typeof r.reviewCount === "number" ? r.reviewCount : 0,
          availability: r.available ? "InStock" : "OutOfStock",
        })),
        pagination: {
          limit: safeLimit,
          offset: safeOffset,
          page: Math.floor(safeOffset / safeLimit) + 1,
          total,
          totalPages: Math.max(1, Math.ceil(total / safeLimit)),
          hasMore: safeOffset + safeLimit < total,
        },
      });
    }

    return NextResponse.json(buildMockResults());
  } catch (err) {
    const fallback = buildMockResults();
    return NextResponse.json({ ...fallback, fallback: true, error: (err as Error).message });
  }
}

