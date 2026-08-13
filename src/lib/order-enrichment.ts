import "server-only";
import type { FirebaseCustomerOrder } from "@/lib/commerce";

// Firestore orders are already the source of truth. Delhivery events are loaded on the order/tracking pages.
export async function enrichCustomerOrders(input: { email: string; orders: FirebaseCustomerOrder[] }) {
  return input.orders;
}
