import TrustBar from "../../components/TrustBar";
import CartClient from "../../components/cart/CartClient";

export const revalidate = 0;
export const metadata = {
  title: "Your Cart - Succulent Sphere",
  description: "Your cart - Handpicked premium succulents to enrich your home.",
  alternates: {
    canonical: "https://succulentsphere.com/cart",
  },
  robots: {
    index: false,
    follow: false,
  },
};

function buildBreadcrumb() {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://succulentsphere.com" },
      { "@type": "ListItem", "position": 2, "name": "Cart", "item": "https://succulentsphere.com/cart" }
    ]
  };
}

export default function CartPage() {
  const breadcrumbJson = buildBreadcrumb();

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJson) }} />

      <section className="bg-[var(--color-bg)] py-12 pt-20">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl font-serif text-center mb-2">Your Cart</h1>
          <p className="text-center text-sm mb-6">Handpicked premium succulents to enrich your home.</p>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <CartClient />
            </div>
            <div>
              <div className="sticky top-24">
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <h3 className="font-semibold mb-2">Cart Summary</h3>
                  <p className="text-sm text-gray-600">Ready to checkout? Secure payment and fast shipping.</p>
                </div>
                <div className="mt-4">
                  <TrustBar />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
