"use client";

import ProductCard from "@/components/shop/ProductCard";

type ComboCollectionProduct = {
  id: string;
  title: string;
  handle: string;
  price: string;
  image: string;
  imageAlt?: string;
};

export default function ComboCollectionGrid({ products }: { products: ComboCollectionProduct[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-3">
      {products.map((product) => {
          const mapped = {
            id: product.id,
            title: product.title,
            handle: product.handle,
            price: product.price,
            currency: "INR",
            image: product.image,
            imageAlt: product.imageAlt || product.title,
            productType: "Combo",
            badge: "Combo",
            rating: 4.7,
            availability: "InStock",
            available: true,
            tags: ["combo", "free_shipping"],
          description: "Curated by our team, packed with care.",
        };
        return (
          <ProductCard
            key={product.id}
            product={mapped as any}
            productBasePath="products"
            wishlistPlacement="meta"
          />
        );
      })}
    </div>
  );
}
