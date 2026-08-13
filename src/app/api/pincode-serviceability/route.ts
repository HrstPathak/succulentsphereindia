import { NextResponse } from "next/server";

type DelhiveryPinEntry = {
  postal_code?: {
    pin?: string | number;
    city?: string;
    district?: string;
    state_code?: string;
    state?: string;
  };
};

function sanitizePincode(value: string): string {
  return String(value || "").replace(/\D/g, "").slice(0, 6);
}

function extractPinEntries(payload: unknown): DelhiveryPinEntry[] {
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;

  const deliveryCodes = record.delivery_codes;
  if (Array.isArray(deliveryCodes)) return deliveryCodes as DelhiveryPinEntry[];

  const pinCodes = record.pin_codes;
  if (Array.isArray(pinCodes)) return pinCodes as DelhiveryPinEntry[];

  return [];
}

function buildDelhiveryUrl(pincode: string, token?: string): string {
  const url = new URL("https://track.delhivery.com/c/api/pin-codes/json/");
  url.searchParams.set("filter_codes", pincode);
  if (token) url.searchParams.set("token", token);
  return url.toString();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pincode = sanitizePincode(searchParams.get("pincode") || "");

  if (!/^\d{6}$/.test(pincode)) {
    return NextResponse.json(
      {
        serviceable: false,
        pincode,
        message: "Please enter a valid 6-digit pincode.",
      },
      { status: 400 }
    );
  }

  try {
    const token = String(process.env.DELHIVERY_API_TOKEN || "").trim();
    const endpoints = token
      ? [buildDelhiveryUrl(pincode, token), buildDelhiveryUrl(pincode)]
      : [buildDelhiveryUrl(pincode)];

    let payload: unknown = null;
    let upstreamStatus = 502;
    let lastErrorText = "";

    for (const endpoint of endpoints) {
      const response = await fetch(endpoint, {
        cache: "no-store",
        headers: {
          Accept: "application/json,text/plain,*/*",
          "User-Agent": "SucculentSphere/1.0 (+https://succulentsphere.com)",
        },
      });

      upstreamStatus = response.status || 502;
      const rawBody = await response.text();
      if (!response.ok) {
        lastErrorText = rawBody.slice(0, 220);
        continue;
      }

      try {
        payload = JSON.parse(rawBody);
        break;
      } catch {
        lastErrorText = "Invalid JSON response from Delhivery.";
      }
    }

    if (!payload) {
      const needsTokenHint = !token;
      const statusHint = upstreamStatus ? ` (HTTP ${upstreamStatus})` : "";
      const tokenHint = needsTokenHint ? " Add DELHIVERY_API_TOKEN in .env.local if your account requires authenticated API access." : "";

      return NextResponse.json(
        {
          serviceable: false,
          pincode,
          message: `Unable to verify pincode right now${statusHint}.${tokenHint}`.trim(),
          debug: process.env.NODE_ENV !== "production" ? lastErrorText : undefined,
        },
        { status: 502 }
      );
    }

    const entries = extractPinEntries(payload);
    const first = entries[0]?.postal_code;
    const serviceable = entries.length > 0;
    const city = String(first?.city || "").trim();
    const district = String(first?.district || "").trim();
    const state = String(first?.state || first?.state_code || "").trim();

    const locationParts = [city, district, state].filter(Boolean);
    const location = locationParts.join(", ");

    return NextResponse.json({
      serviceable,
      pincode,
      city,
      district,
      state,
      location,
      message: serviceable
        ? location
          ? `Delivery available for ${pincode} (${location}).`
          : `Delivery available for ${pincode}.`
        : `Sorry, we currently do not deliver to ${pincode}.`,
    });
  } catch {
    return NextResponse.json(
      {
        serviceable: false,
        pincode,
        message: "Unable to verify pincode right now. Please try again.",
      },
      { status: 502 }
    );
  }
}
