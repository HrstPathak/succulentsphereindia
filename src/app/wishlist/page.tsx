import type { Metadata } from "next";
import WishlistPage from "@/components/wishlist/WishlistPage";
import { getAuthenticatedUid } from "@/lib/auth";
import { fetchProductsByIds } from "@/lib/commerce";
import { getFirebaseDb } from "@/lib/firebase-admin";
import { normalizeWishlistIds, toWishlistProducts, WISHLIST_MAX_IDS, type WishlistProduct } from "@/lib/wishlist";

export const metadata: Metadata = {
  title: "Wishlist - Succulent Sphere",
  description: "Your saved succulent picks, ready for checkout.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function WishlistRoutePage() {
  // Seed the first paint for signed-in shoppers: reading the session cookie
  // keeps this route dynamic, so the saved ids can be resolved here and the
  // grid no longer waits for a client round-trip after hydration. Guests keep
  // their wishlist in localStorage, so it is still hydrated on the client.
  let initialProducts: WishlistProduct[] = [];
  let initialResolved = false;

  try {
    const session = await getAuthenticatedUid();
    if (session.uid) {
      const user = await getFirebaseDb().collection("users").doc(session.uid).get();
      const productIds = normalizeWishlistIds(user.get("wishlistProductIds")).slice(0, WISHLIST_MAX_IDS);
      initialProducts = toWishlistProducts(await fetchProductsByIds(productIds));
      initialResolved = true;
    }
  } catch (error) {
    console.error("Failed to seed the wishlist:", error);
  }

  return <WishlistPage initialProducts={initialProducts} initialResolved={initialResolved} />;
}
