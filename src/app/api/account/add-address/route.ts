import { NextResponse } from "next/server";
import { clearAuthCookies, getAuthenticatedCustomer } from "@/lib/auth";
import { createAddress, fetchCustomerByUid } from "@/lib/commerce";

export async function POST(request: Request) {
  try { const session = await getAuthenticatedCustomer(); if (!session.uid) { const response = NextResponse.json({ error: "Unauthorized." }, { status: 401 }); clearAuthCookies(response); return response; }
    const body = await request.json(); const address = { firstName: String(body.firstName || ""), lastName: String(body.lastName || ""), company: String(body.company || ""), address1: String(body.address1 || "").trim(), address2: String(body.address2 || ""), city: String(body.city || "").trim(), province: String(body.province || ""), country: String(body.country || "").trim(), zip: String(body.zip || "").trim(), phone: String(body.phone || "") };
    if (!address.address1 || !address.city || !address.country || !address.zip) return NextResponse.json({ error: "Address line 1, city, country, and zip are required." }, { status: 400 });
    await createAddress(session.uid, address); return NextResponse.json({ ok: true, customer: await fetchCustomerByUid(session.uid) });
  } catch (error) { return NextResponse.json({ error: (error as Error).message || "Unable to add address." }, { status: 500 }); }
}
