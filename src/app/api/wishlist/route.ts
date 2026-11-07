import { NextResponse } from "next/server";
import { clearAuthCookies, getAuthenticatedUid } from "@/lib/auth";
import { fetchProductsByIds } from "@/lib/commerce";
import { getFirebaseDb } from "@/lib/firebase-admin";
import { mergeWishlistIds, normalizeWishlistIds, toWishlistProducts, WISHLIST_MAX_IDS } from "@/lib/wishlist";

function ids(value: unknown) {
  return normalizeWishlistIds(Array.isArray(value) ? value : []).slice(0, WISHLIST_MAX_IDS);
}

// Product payloads are projected to the fields the wishlist grid renders
// (see toWishlistProduct) instead of shipping whole product documents.
async function productsFor(productIds: string[]) {
  return toWishlistProducts(await fetchProductsByIds(productIds));
}

export async function GET() {
  try {
    // Only the uid is needed here; getAuthenticatedCustomer() would also pull
    // addresses, orders and wallet on every storefront page load.
    const session = await getAuthenticatedUid();
    if (!session.uid) {
      const response = NextResponse.json({ authenticated: false, items: [], ids: [], products: [] });
      if (session.error) clearAuthCookies(response);
      return response;
    }
    const user = await getFirebaseDb().collection("users").doc(session.uid).get();
    const productIds = ids(user.get("wishlistProductIds"));
    return NextResponse.json({ authenticated: true, items: productIds, ids: productIds, products: await productsFor(productIds) });
  } catch (error) {
    console.error("[wishlist] GET failed", error);
    return NextResponse.json({ error: "Unable to load wishlist." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    let body: Record<string, unknown>;
    try {
      const parsed: unknown = await request.json();
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return NextResponse.json({ error: "Invalid wishlist request." }, { status: 400 });
      }
      body = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid wishlist request." }, { status: 400 });
    }

    const action = String(body?.action || "set");
    if (action !== "products" && action !== "merge" && action !== "set") {
      return NextResponse.json({ error: "Unsupported wishlist action." }, { status: 400 });
    }

    // Guest hydration: the wishlist lives in localStorage for signed-out
    // shoppers, who still need the matching products rendered on /wishlist.
    // This request used to fall through to the authenticated branch and 401,
    // so guests saw an empty wishlist while the header badge counted their
    // saved items.
    if (action === "products") {
      const productIds = ids(body?.ids || body?.productIds);
      return NextResponse.json({ authenticated: false, items: productIds, ids: productIds, products: await productsFor(productIds) });
    }

    const session = await getAuthenticatedUid();
    if (!session.uid) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const userRef = getFirebaseDb().collection("users").doc(session.uid);
    let productIds = ids(body?.ids || body?.productIds);

    // "merge" is sent right after sign-in with the guest list; union it with
    // what is already stored instead of overwriting the account wishlist.
    if (action === "merge") {
      const stored = ids((await userRef.get()).get("wishlistProductIds"));
      productIds = mergeWishlistIds(stored, productIds);
    }

    await userRef.set({ wishlistProductIds: productIds, updatedAt: new Date().toISOString() }, { merge: true });
    return NextResponse.json({ ok: true, authenticated: true, items: productIds, ids: productIds, products: await productsFor(productIds) });
  } catch (error) {
    console.error("[wishlist] POST failed", error);
    return NextResponse.json({ error: "Unable to update wishlist." }, { status: 500 });
  }
}
