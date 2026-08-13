import type { Metadata } from "next";
import OrderTrackerClient from "@/components/order-tracker/OrderTrackerClient";

export const metadata: Metadata = {
  title: "Track Your Order",
  description:
    "Track your Succulent Hub order status from confirmation to delivery with real-time shipment updates.",
  alternates: {
    canonical: "/order-tracker",
  },
};

export default function OrderTrackerPage() {
  return <OrderTrackerClient />;
}

