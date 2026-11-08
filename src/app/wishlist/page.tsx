import type { Metadata } from "next";
import WishlistPage from "@/components/wishlist/WishlistPage";

export const metadata: Metadata = {
  title: "Wishlist - Succulent Sphere",
  description: "Your saved succulent picks, ready for checkout.",
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Keep this page as a cacheable shell. Wishlist data is already fetched by the
 * client provider, so doing the same session and Firestore reads during SSR
 * made every signed-in visit load the wishlist twice.
 */
export default function WishlistRoutePage() {
  return <WishlistPage />;
}
