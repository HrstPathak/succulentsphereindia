import { inferCollectionFromProduct, normalizeText, toPrice } from "@/lib/productFilters";

/**
 * Quick-pick category chips that sit between the filter bar and the product grid.
 *
 * They are ordinary catalog filters (they live in `SearchFilters.chips`, travel in
 * the `chips` query param and are applied by `/api/products`), so pagination,
 * sorting and the filter drawer all keep working while a chip is active.
 *
 * To add or rename a chip, edit this array only - the UI, the URL codec and the
 * API matcher all read from here.
 */
export type CatalogChip = {
  id: string;
  label: string;
};

export const CATALOG_CHIPS: CatalogChip[] = [
  { id: "succulent", label: "Succulent" },
  { id: "cactus", label: "Cactus" },
  { id: "under-40", label: "39Rs" },
  { id: "combo", label: "Combo" },
];

export const CATALOG_CHIP_IDS: string[] = CATALOG_CHIPS.map((chip) => chip.id);

/** Query param used in both the browser URL and the `/api/products` request. */
export const CATALOG_CHIPS_PARAM = "chips";

/** Matches the `MAX_PRICE` of `/collections/succulents-under-40` (Rs. 39 and under). */
export const CATALOG_CHIP_UNDER_40_MAX = 39;

/**
 * Reads `?chips=succulent,combo` back into ids, dropping anything unknown and
 * returning them in declaration order so the URL is stable regardless of the
 * order chips were clicked in.
 */
export function parseCatalogChips(value: string | string[] | null | undefined): string[] {
  const entries = (Array.isArray(value) ? value : [value])
    .filter((entry): entry is string => typeof entry === "string")
    .flatMap((entry) => entry.split(","))
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  if (entries.length === 0) return [];
  return CATALOG_CHIP_IDS.filter((id) => entries.includes(id));
}

type ChipProduct = {
  price?: string | number;
  productType?: string;
  type?: string;
  title?: string;
  tags?: string[];
  collections?: string[];
};

/**
 * Selected chips are OR-ed together (picking "Succulent" + "Combo" shows both),
 * and the result is AND-ed with every other catalog filter by the caller.
 * An empty selection matches everything - that is the "All" chip.
 */
export function productMatchesCatalogChips(product: ChipProduct, chipIds: string[]): boolean {
  if (!Array.isArray(chipIds) || chipIds.length === 0) return true;

  const type = normalizeText(product?.productType || product?.type);
  const title = normalizeText((product as { title?: string })?.title);
  const tags = Array.isArray(product?.tags) ? product.tags.map((tag) => normalizeText(tag)) : [];
  const collections = Array.isArray(product?.collections)
    ? product.collections.map((collection) => normalizeText(collection))
    : [];
  const haystack = [type, title, ...tags, ...collections].join(" ");
  const collection = inferCollectionFromProduct(product as never);
  const price = toPrice(product?.price);

  return chipIds.some((chipId) => {
    switch (chipId) {
      case "succulent":
        return (
          collection === "succulents" ||
          type.includes("succulent") ||
          haystack.includes("succulent") ||
          haystack.includes("echeveria") ||
          haystack.includes("haworthia") ||
          haystack.includes("crassula") ||
          haystack.includes("sedum")
        );
      case "cactus":
        return collection === "cacti" || type.includes("cactus") || type.includes("cacti") || haystack.includes("cact");
      case "combo":
        // Bundles only: product type "Combo". Single plants carry a "Combo"
        // tag (combo-builder eligible) but must not match this chip.
        return type.includes("combo");
      case "under-40":
        return price > 0 && price <= CATALOG_CHIP_UNDER_40_MAX;
      default:
        return false;
    }
  });
}
