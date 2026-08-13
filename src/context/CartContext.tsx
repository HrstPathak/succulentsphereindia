"use client";
import React, { createContext, useContext, useEffect, useState } from "react";

type CartItem = {
  id: string;
  title: string;
  price: string;
  image: string;
  imageAlt?: string;
  itemCategory?: string;
  handle: string;
  quantity: number;
  tags?: string[];
  bundleId?: string;
  bundleTitle?: string;
  bundleDiscountRate?: number;
  isBundleHeader?: boolean;
};

type CartContextValue = {
  items: CartItem[];
  count: number;
  addToCart: (item: Omit<CartItem, "quantity">, qty?: number) => void;
  removeFromCart: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("ss_cart");
      if (raw) setItems(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("ss_cart", JSON.stringify(items));
    } catch {}
  }, [items]);

  const addToCart = (item: Omit<CartItem, "quantity">, qty = 1) => {
    setItems((prev) => {
      const found = prev.find((p) => p.id === item.id);
      if (found) {
        return prev.map((p) => (p.id === item.id ? { ...p, quantity: p.quantity + qty } : p));
      }
      return [...prev, { ...item, quantity: qty }];
    });

    // GTM/GA4 add_to_cart ecommerce push.
    try {
      if (typeof window === "undefined") return;
      const itemId = String(item?.id || "").trim();
      const itemName = String(item?.title || "").trim();
      const itemCategory = String(item?.itemCategory || "").trim();
      const price = Number(item?.price);

      if (!itemId || !itemName || !price) return;

      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ ecommerce: null });
      window.dataLayer.push({
        event: "add_to_cart",
        ecommerce: {
          currency: "INR",
          value: price,
          items: [
            {
              item_id: itemId,
              item_name: itemName,
              item_category: itemCategory,
              price: price,
              quantity: 1,
            },
          ],
        },
      });
    } catch {
      // Do not break cart functionality if analytics push fails.
    }
  };

  const removeFromCart = (id: string) => setItems((prev) => prev.filter((p) => p.id !== id));
  const updateQty = (id: string, qty: number) =>
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, quantity: Math.max(1, qty) } : p)));
  const clear = () => setItems([]);

  const value: CartContextValue = {
    items,
    count: items.reduce((s, it) => s + it.quantity, 0),
    addToCart,
    removeFromCart,
    updateQty,
    clear
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

