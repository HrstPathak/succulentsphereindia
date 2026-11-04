import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";

export const CATALOG_TAG = "catalog";
export const COMBO_PRODUCTS_TAG = "combo-products";
export const COMBO_BUILDER_TAG = "combo-builder-products";
export const COMBO_CACHE_SECONDS = 300;

export function invalidateComboPages() {
  revalidatePath("/combo");
  revalidatePath("/combo-builder");
  revalidateTag(COMBO_PRODUCTS_TAG, { expire: 0 });
  revalidateTag(COMBO_BUILDER_TAG, { expire: 0 });
}
