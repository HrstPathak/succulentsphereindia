"use client";
import { ReactNode } from "react";
import { CartProvider } from "../context/CartContext";
import { FilterProvider } from "../context/FilterContext";
import { WishlistProvider } from "../context/WishlistContext";
import ToastProvider from "./ToastProvider";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <FilterProvider>
      <WishlistProvider>
        <CartProvider>
          {children}
          <ToastProvider />
        </CartProvider>
      </WishlistProvider>
    </FilterProvider>
  );
}
