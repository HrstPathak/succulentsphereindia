import { NextResponse } from "next/server";

// Checkout is handled by the Firebase-backed Razorpay endpoints.
export async function POST() {
  return NextResponse.json({ error: "Use /api/razorpay/create-order for checkout." }, { status: 410 });
}
