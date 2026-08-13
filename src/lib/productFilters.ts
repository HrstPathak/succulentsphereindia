export type CatalogCollection =
  | "succulents"
  | "pots"
  | "gift-collection"
  | "cacti"
  | "air-purifier"
  | "other";

export type CatalogProduct = {
  id: string;
  title?: string;
  handle?: string;
  type?: string;
  careLevel?: string;
  plantGenus?: string;
  potSize?: string;
  potMaterial?: string;
  description?: string;
  tags?: string[];
  collections?: string[];
  price?: string | number;
  available?: boolean;
  createdAt?: string;
};

const SUCCULENT_TYPE_PATTERNS = [
  "echeveria",
  "crassula",
  "haworthia",
  "sedum",
  "string succulents",
  "aloe",
  "kalanchoe",
  "aeonium",
] as const;

export const COLLECTION_LABELS: Record<CatalogCollection, string> = {
  succulents: "Succulent",
  pots: "Pots",
  "gift-collection": "Gift Collection",
  cacti: "Cacti",
  "air-purifier": "Air Purifier",
  other: "Other",
};

export function normalizeText(value: string | null | undefined) {
  if (!value) return "";
  return value.trim().toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ");
}

export function inferCollectionFromProduct(product: CatalogProduct): CatalogCollection {
  const collectionHandles = (product.collections || []).map((h) => resolveCollectionHandle(h));
  if (collectionHandles.includes("cacti")) return "cacti";
  if (collectionHandles.includes("pots")) return "pots";
  if (collectionHandles.includes("succulents")) return "succulents";
  if (collectionHandles.includes("gift-collection")) return "gift-collection";
  if (collectionHandles.includes("air-purifier")) return "air-purifier";

  const title = normalizeText(product.title);
  const type = normalizeText(product.type);
  const tags = (product.tags || []).map(normalizeText);
  const haystack = [title, type, ...tags].join(" ");

  if (type.includes("pot") || type.includes("planter")) return "pots";
  if (haystack.includes("cacti") || haystack.includes("cactus")) return "cacti";
  if (
    haystack.includes("succulent") ||
    haystack.includes("echeveria") ||
    haystack.includes("crassula") ||
    haystack.includes("haworthia") ||
    haystack.includes("sedum")
  ) {
    return "succulents";
  }
  if (haystack.includes("pot") || haystack.includes("planter")) return "pots";
  if (haystack.includes("gift") || haystack.includes("combo") || haystack.includes("hamper")) return "gift-collection";
  if (haystack.includes("air purifier") || haystack.includes("air plant")) return "air-purifier";
  return "other";
}

export function resolveCollectionHandle(value: string) {
  const normalized = normalizeText(value).replace(/\s+/g, "-");
  if (normalized === "air-plants") return "air-purifier";
  if (normalized === "gift") return "gift-collection";
  if (normalized === "cactus") return "cacti";
  return normalized;
}

export function productMatchesCollection(product: CatalogProduct, collectionHandle: string) {
  const resolved = resolveCollectionHandle(collectionHandle || "");
  if (!resolved) return true;
  if (resolved === "succulents" && isPotProduct(product)) return false;
  if (inferCollectionFromProduct(product) === resolved) return true;

  const type = normalizeText(product.type);
  if (!type) return false;

  if (resolved === "succulents") {
    return (
      type.includes("succulent") ||
      type.includes("echeveria") ||
      type.includes("crassula") ||
      type.includes("haworthia") ||
      type.includes("sedum")
    );
  }
  if (resolved === "cacti") {
    return type.includes("cactus") || type.includes("cacti");
  }
  if (resolved === "pots") {
    return type.includes("pot") || type.includes("planter");
  }
  if (resolved === "gift-collection") {
    return type.includes("gift") || type.includes("combo") || type.includes("hamper");
  }
  if (resolved === "air-purifier") {
    return type.includes("air purifier") || type.includes("air plant");
  }
  return false;
}

function isPotProduct(product: CatalogProduct): boolean {
  const collectionHandles = (product.collections || []).map((h) => resolveCollectionHandle(h));
  if (collectionHandles.includes("pots")) return true;

  const type = normalizeText(product.type);
  if (type.includes("pot") || type.includes("planter")) return true;

  const tags = (product.tags || []).map(normalizeText);
  if (tags.some((tag) => tag.includes("pot") || tag.includes("planter"))) return true;

  return false;
}

export function inferSucculentType(product: CatalogProduct): string | null {
  const title = normalizeText(product.title);
  const type = normalizeText(product.type);
  const tags = (product.tags || []).map(normalizeText);
  const haystack = [title, type, ...tags].join(" ");

  for (const pattern of SUCCULENT_TYPE_PATTERNS) {
    if (haystack.includes(pattern)) {
      return pattern
        .split(" ")
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(" ");
    }
  }

  if (haystack.includes("string of")) return "String Succulents";
  return null;
}

export function inferCareLevel(product: CatalogProduct): string {
  const fromField = (product.careLevel || "").trim();
  if (fromField) return toTitleCase(fromField);

  const tags = (product.tags || []).map(normalizeText);
  const hit = tags.find((t) => t === "beginner" || t === "intermediate" || t === "advanced");
  if (hit) return toTitleCase(hit);

  const rawDescription = String(product.description || "");
  const normalizedDescription = normalizeText(rawDescription);
  const careGuideIndex = rawDescription.toLowerCase().indexOf("care guide");
  const careGuideRaw = careGuideIndex >= 0 ? rawDescription.slice(careGuideIndex) : rawDescription;
  const careGuide = normalizeText(careGuideRaw);

  if (normalizedDescription.includes("for beginners") || normalizedDescription.includes("perfect for beginners")) {
    return "Beginner";
  }
  if (normalizedDescription.includes("advanced care") || normalizedDescription.includes("for advanced growers")) {
    return "Advanced";
  }
  if (normalizedDescription.includes("intermediate care") || normalizedDescription.includes("for intermediate growers")) {
    return "Intermediate";
  }

  let beginnerScore = 0;
  let intermediateScore = 0;
  let advancedScore = 0;

  const beginnerSignals = [
    "bright indirect light",
    "bright indirect sunlight",
    "minimal watering",
    "water when soil is completely dry",
    "water when soil is dry",
    "low maintenance",
    "easy care",
    "drought tolerant",
    "beginner",
  ];
  const intermediateSignals = [
    "protect farina",
    "avoid touching leaves",
    "morning sunlight",
    "seasonal",
    "rotate",
    "repot",
    "pruning",
    "fertilize",
    "collector",
  ];
  const advancedSignals = [
    "advanced",
    "expert",
    "experienced growers",
    "strict",
    "high humidity",
    "daily misting",
    "rare",
    "delicate",
    "sensitive",
  ];

  for (const signal of beginnerSignals) {
    if (normalizedDescription.includes(signal) || careGuide.includes(signal)) beginnerScore += 1;
  }
  for (const signal of intermediateSignals) {
    if (normalizedDescription.includes(signal) || careGuide.includes(signal)) intermediateScore += 1;
  }
  for (const signal of advancedSignals) {
    if (normalizedDescription.includes(signal) || careGuide.includes(signal)) advancedScore += 1;
  }

  if (advancedScore >= 2 && advancedScore >= intermediateScore) return "Advanced";
  if (intermediateScore >= 2 && intermediateScore >= beginnerScore) return "Intermediate";
  if (beginnerScore >= 1) return "Beginner";
  return "Beginner";
}

  // Filter-only care level: the "Beginner" tag maps to Beginner; everything else maps to Advanced.
export function inferFilterCareLevel(product: CatalogProduct): "Beginner" | "Advanced" {
  const tags = (product.tags || []).map(normalizeText);
  return tags.includes("beginner") ? "Beginner" : "Advanced";
}

export function inferPlantGenus(product: CatalogProduct): string | null {
  const fromMetafield = toTitleCase((product.plantGenus || "").trim());
  if (fromMetafield) return fromMetafield;
  return inferSucculentType(product);
}

export function inferPotSize(product: CatalogProduct): string | null {
  const fromMetafield = toTitleCase((product.potSize || "").trim());
  if (fromMetafield) return fromMetafield;

  const title = normalizeText(product.title);
  const type = normalizeText(product.type);
  const tags = (product.tags || []).map(normalizeText);
  const haystack = [title, type, ...tags].join(" ");

  if (haystack.includes("extra small") || haystack.includes("xs")) return "Extra Small";
  if (haystack.includes("small")) return "Small";
  if (haystack.includes("medium")) return "Medium";
  if (haystack.includes("large")) return "Large";
  if (haystack.includes("xl") || haystack.includes("extra large")) return "Extra Large";
  return null;
}

export function inferPotMaterial(product: CatalogProduct): string | null {
  const fromMetafield = toTitleCase((product.potMaterial || "").trim());
  if (fromMetafield) return fromMetafield;

  const title = normalizeText(product.title);
  const type = normalizeText(product.type);
  const tags = (product.tags || []).map(normalizeText);
  const haystack = [title, type, ...tags].join(" ");

  if (haystack.includes("ceramic")) return "Ceramic";
  if (haystack.includes("plastic")) return "Plastic";
  if (haystack.includes("terracotta") || haystack.includes("clay")) return "Terracotta";
  if (haystack.includes("metal")) return "Metal";
  if (haystack.includes("concrete")) return "Concrete";
  if (haystack.includes("glass")) return "Glass";
  if (haystack.includes("wood")) return "Wood";
  return null;
}

export function toTitleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join(" ");
}

export function toPrice(value: string | number | undefined) {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function matchesTextQuery(product: CatalogProduct, query: string) {
  const q = normalizeText(query);
  if (!q) return true;
  const haystack = [
    normalizeText(product.title),
    normalizeText(product.handle),
    normalizeText(product.type),
    ...(product.tags || []).map(normalizeText),
  ].join(" ");
  return haystack.includes(q);
}
