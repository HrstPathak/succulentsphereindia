import { NextResponse } from "next/server";
import { PRICE_MAX, PRICE_MIN } from "../../../context/FilterContext";
import { fetchAllProductsList } from "../../../lib/commerce";
import {
  COLLECTION_LABELS,
  inferPlantGenus,
  inferPotMaterial,
  inferPotSize,
  inferFilterCareLevel,
  inferCollectionFromProduct,
  normalizeText,
  productMatchesCollection,
  resolveCollectionHandle,
  toPrice,
} from "../../../lib/productFilters";

function parseCsv(value: string | null) {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function applyScope(items: any[], scope: string, collectionHandle: string) {
  if (scope === "succulents") {
    return items.filter((p) => inferCollectionFromProduct(p) === "succulents");
  }
  if (scope === "collection" && collectionHandle) {
    return items.filter((p) => productMatchesCollection(p, collectionHandle));
  }
  return items;
}

function hasTag(tags: string[] | undefined, wanted: string) {
  if (!Array.isArray(tags) || tags.length === 0) return false;
  const normalizedWanted = wanted.trim().toLowerCase();
  if (!normalizedWanted) return true;
  return tags.some((tag) => String(tag || "").trim().toLowerCase() === normalizedWanted);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const scope = searchParams.get("scope") || "shop";
    const collectionHandle = searchParams.get("collectionHandle") || "";
    const requiredTag = (searchParams.get("tag") || "").trim();
    const selectedCollections = parseCsv(searchParams.get("collections"));

    const source = await fetchAllProductsList({ sortKey: "BEST_SELLING", reverse: false });
    const normalized = source.map((p: any) => ({
      id: p.id,
      title: p.title,
      handle: p.handle,
      type: p.type || p.productType || "",
      careLevel: p.careLevel || "",
      plantGenus: p.plantGenus || "",
      potSize: p.potSize || "",
      potMaterial: p.potMaterial || "",
      description: p.description || "",
      collections: p.collections || [],
      tags: p.tags || [],
      price: p.price ?? "0.00",
      available: typeof p.available === "boolean" ? p.available : p.availability === "InStock",
      createdAt: p.createdAt || "",
    }));

    let scoped = applyScope(normalized, scope, collectionHandle);
    if (requiredTag) {
      scoped = scoped.filter((p) => hasTag(p.tags, requiredTag));
    }
    if (selectedCollections.length > 0) {
      const allowed = selectedCollections.map((v) => resolveCollectionHandle(normalizeText(v).replace(/\s+/g, "-")));
      scoped = scoped.filter((p) => allowed.some((collection) => productMatchesCollection(p, collection)));
    }

    const collections = Array.from(
      new Set(scoped.map((p) => inferCollectionFromProduct(p)).filter((c) => c !== "other"))
    ).map((key) => ({
      value: key,
      label: COLLECTION_LABELS[key as keyof typeof COLLECTION_LABELS] || key,
    }));

    const productType = Array.from(
      new Set(
        scoped
          .map((p) => String(p.type || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));

    const plantGenus = Array.from(
      new Set(
        scoped
          .filter((p) => inferCollectionFromProduct(p) === "succulents")
          .map((p) => inferPlantGenus(p))
          .filter(Boolean) as string[]
      )
    ).sort((a, b) => a.localeCompare(b));

    const potSize = Array.from(
      new Set(
        scoped
          .filter((p) => inferCollectionFromProduct(p) === "pots")
          .map((p) => inferPotSize(p))
          .filter(Boolean) as string[]
      )
    ).sort((a, b) => a.localeCompare(b));

    const potMaterial = Array.from(
      new Set(
        scoped
          .filter((p) => inferCollectionFromProduct(p) === "pots")
          .map((p) => inferPotMaterial(p))
          .filter(Boolean) as string[]
      )
    ).sort((a, b) => a.localeCompare(b));

    const careLevel = Array.from(new Set(scoped.map((p) => inferFilterCareLevel(p)).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b)
    );

    const prices = scoped.map((p) => toPrice(p.price));
    const minPrice = prices.length ? Math.max(PRICE_MIN, Math.floor(Math.min(...prices))) : PRICE_MIN;
    const maxPrice = prices.length ? Math.min(PRICE_MAX, Math.ceil(Math.max(...prices))) : PRICE_MAX;

    return NextResponse.json({
      facets: {
        collections,
        productType,
        plantGenus,
        potSize,
        potMaterial,
        careLevel,
        availability: true,
        priceRange: { min: minPrice, max: maxPrice },
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        facets: {
          collections: [],
          productType: [],
          plantGenus: [],
          potSize: [],
          potMaterial: ["Plastic", "Ceramic"],
          careLevel: ["Beginner", "Advanced"],
          availability: true,
          priceRange: { min: PRICE_MIN, max: PRICE_MAX },
        },
        error: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
