"use client";
import { ReactNode } from "react";
import { CartProvider } from "../context/CartContext";
import { FilterProvider } from "../context/FilterContext";
import { WishlistProvider } from "../context/WishlistContext";
import { CustomerSessionProvider } from "../context/CustomerSessionContext";
import ToastProvider from "./ToastProvider";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <CustomerSessionProvider>
      <FilterProvider>
        <WishlistProvider>
          <CartProvider>
            {children}
            <ToastProvider />
          </CartProvider>
        </WishlistProvider>
      </FilterProvider>
    </CustomerSessionProvider>
  );
}
