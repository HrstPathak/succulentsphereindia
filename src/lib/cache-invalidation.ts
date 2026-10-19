import "server-only";

import { revalidatePath } from "next/cache";
import { invalidateCatalogCacheAsync, invalidateProductReviewsCacheAsync } from "@/lib/commerce";

export type ProductCacheScope = "product" | "stock" | "reviews";

export interface InvalidateProductCachesInput {
  handles?: string[];
  ids?: string[];
  oldHandles?: string[];
  scope: ProductCacheScope;
  allProductPages?: boolean;
  includeSitemap?: boolean;
}

export interface InvalidateProductCachesResult {
  catalog: boolean;
  reviews: boolean;
  paths: string[];
  errors: string[];
}

function cleanValues(values: readonly unknown[] | undefined): string[] {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value ?? "").trim()).filter(Boolean))];
}

function markError(result: InvalidateProductCachesResult, error: unknown, context: string) {
  const message = error instanceof Error ? error.message : String(error ?? "Unknown error");
  result.errors.push(`${context}: ${message}`);
}

export async function invalidateProductCaches(
  input: InvalidateProductCachesInput,
): Promise<InvalidateProductCachesResult> {
  const result: InvalidateProductCachesResult = {
    catalog: false,
    reviews: false,
    paths: [],
    errors: [],
  };

  try {
    const handles = cleanValues([...(input.handles ?? []), ...(input.oldHandles ?? [])]);
    const ids = cleanValues(input.ids);
    const pathsToRevalidate = new Set<string>();
    if (!handles.length && !input.allProductPages) {
      result.errors.push("no product handles supplied; product pages not revalidated");
    }

    if (input.scope === "product" || input.scope === "stock") {
      try {
        await invalidateCatalogCacheAsync();
        result.catalog = true;
      } catch (error) {
        markError(result, error, "catalog invalidation");
      }

      for (const path of [
        "/",
        "/shop",
        "/collections",
        "/collections/succulents",
        "/collections/beginner-friendly",
        "/collections/cactus",
        "/collections/pots",
        "/collections/succulents-under-40",
        "/combo",
        "/combo-builder",
        "/api/products",
        "/api/filters",
      ]) {
        pathsToRevalidate.add(path);
      }
    }

    if (input.scope === "reviews" || input.scope === "product") {
      for (const id of ids) {
        try {
          await invalidateProductReviewsCacheAsync(id);
          result.reviews = true;
        } catch (error) {
          markError(result, error, `review invalidation(${id})`);
        }
      }
    }

    if (input.allProductPages && input.scope !== "reviews") {
      pathsToRevalidate.add("/collections/succulents/[handle]");
      pathsToRevalidate.add("/products/[handle]");
    } else {
      for (const handle of handles) {
        pathsToRevalidate.add(`/collections/succulents/${handle}`);
        pathsToRevalidate.add(`/products/${handle}`);
      }
    }

    if (input.includeSitemap && input.scope !== "reviews") {
      pathsToRevalidate.add("/sitemap.xml");
    }

    for (const path of pathsToRevalidate) {
      try {
        if (input.allProductPages && (path === "/collections/succulents/[handle]" || path === "/products/[handle]")) {
          revalidatePath(path, "page");
        } else {
          revalidatePath(path);
        }
        result.paths.push(path);
      } catch (error) {
        markError(result, error, `revalidatePath(${path})`);
      }
    }
  } catch (error) {
    markError(result, error, "invalidation setup");
  }
  return result;
}
