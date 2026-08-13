"use client";

import { useState } from "react";

type Product = {
  id: string;
  title: string;
  price: number;
  inventoryQuantity: number;
  available: boolean;
};

const inr = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);

export default function AdminTestOrderModal({
  products,
  onClose,
  onCreated,
}: {
  products: Product[];
  onClose: () => void;
  onCreated: (message: string) => void;
}) {
  const saleable = products.filter(
    (product) => product.available && product.inventoryQuantity > 0,
  );
  const [customer, setCustomer] = useState({
    fullName: "",
    email: "",
    phone: "",
  });
  const [productId, setProductId] = useState(saleable[0]?.id || "");
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function submit() {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/test-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer, items: [{ productId, quantity }] }),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error || "Unable to create test order.");
      onCreated(
        `Test order #${payload.orderNumber} created. Confirmation email was triggered.`,
      );
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[110] overflow-y-auto bg-[#102419]/55 p-3 backdrop-blur-sm sm:p-8">
      <div className="mx-auto flex min-h-full max-w-2xl items-center">
        <section
          role="dialog"
          aria-modal="true"
          aria-label="Create payment-free test order"
          className="w-full rounded-[28px] bg-[#f7f9f5] shadow-2xl"
        >
          <header className="flex items-center justify-between border-b border-[#dce5dc] bg-white px-5 py-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.18em] text-[#6e826f]">
                Admin only
              </p>
              <h2 className="font-serif text-2xl">
                Create payment-free test order
              </h2>
            </div>
            <button
              onClick={onClose}
              className="rounded-xl p-2 text-xl"
              aria-label="Close"
            >
              ×
            </button>
          </header>
          <div className="space-y-5 p-5">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <strong>Test mode:</strong> no payment is charged and no Delhivery
              shipment is created. It does use live inventory, creates a clearly
              marked TEST order, and sends the normal confirmation email.
            </div>
            <div className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Recipient name
                <input
                  className="mt-1 w-full rounded-xl border p-2.5 font-normal"
                  value={customer.fullName}
                  onChange={(event) =>
                    setCustomer({ ...customer, fullName: event.target.value })
                  }
                />
              </label>
              <label className="text-sm font-medium">
                Recipient email
                <input
                  type="email"
                  className="mt-1 w-full rounded-xl border p-2.5 font-normal"
                  value={customer.email}
                  onChange={(event) =>
                    setCustomer({ ...customer, email: event.target.value })
                  }
                />
              </label>
              <label className="text-sm font-medium">
                Phone (optional)
                <input
                  className="mt-1 w-full rounded-xl border p-2.5 font-normal"
                  value={customer.phone}
                  onChange={(event) =>
                    setCustomer({ ...customer, phone: event.target.value })
                  }
                />
              </label>
              <label className="text-sm font-medium">
                Product
                <select
                  className="mt-1 w-full rounded-xl border p-2.5 font-normal"
                  value={productId}
                  onChange={(event) => setProductId(event.target.value)}
                >
                  {saleable.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.title} — {inr(product.price)} (
                      {product.inventoryQuantity} in stock)
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium">
                Quantity
                <input
                  type="number"
                  min="1"
                  max="25"
                  className="mt-1 w-full rounded-xl border p-2.5 font-normal"
                  value={quantity}
                  onChange={(event) =>
                    setQuantity(Number(event.target.value) || 1)
                  }
                />
              </label>
            </div>
            {!saleable.length && (
              <p className="text-sm text-rose-700">
                There are no available products to include in a test order.
              </p>
            )}
            {notice && <p className="text-sm text-rose-700">{notice}</p>}
            <footer className="flex justify-end gap-3">
              <button
                onClick={onClose}
                className="rounded-xl border px-4 py-2 font-bold"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={busy || !productId}
                className="rounded-xl bg-[#24563e] px-4 py-2 font-bold text-white"
              >
                {busy ? "Creating…" : "Create test order & email"}
              </button>
            </footer>
          </div>
        </section>
      </div>
    </div>
  );
}
