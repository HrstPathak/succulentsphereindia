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

export default function WishlistRoutePage() {
  return <WishlistPage />;
}
