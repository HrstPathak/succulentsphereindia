import { NextResponse } from "next/server";
import { checkDelhiveryServiceability } from "@/lib/delhivery-server";
import { normalizeDelhiveryPincode } from "@/lib/delhivery-shipment";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pincode = normalizeDelhiveryPincode(searchParams.get("pincode") || "");
  const paymentMode = searchParams.get("mode") === "COD" ? "COD" : "Prepaid";
  if (!/^\d{6}$/.test(pincode)) {
    return NextResponse.json(
      { serviceable: false, paymentServiceable: false, pincode, message: "Please enter a valid 6-digit pincode." },
      { status: 400 },
    );
  }

  try {
    const result = await checkDelhiveryServiceability({ pincode, paymentMode });
    return NextResponse.json({
      serviceable: result.serviceable,
      paymentServiceable: result.paymentServiceable,
      pincode: result.pincode,
      city: result.city,
      district: result.district,
      state: result.state,
      location: [result.city, result.district, result.state].filter(Boolean).join(", "),
      message: result.message,
      checkedAt: result.checkedAt,
    });
  } catch {
    return NextResponse.json(
      {
        serviceable: false,
        paymentServiceable: false,
        pincode,
        message:
          "Delhivery serviceability is temporarily unavailable. You may continue; the order will remain pending manual review before dispatch.",
      },
      { status: 503 },
    );
  }
}