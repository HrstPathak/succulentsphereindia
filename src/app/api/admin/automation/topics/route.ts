import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getFirebaseDb } from "@/lib/firebase-admin";

const AUTH_ERROR = "ADMIN_REQUIRED";

/** Stealth-404 on non-admin access, matching src/app/api/admin/articles/route.ts. */
function authStatus(error: unknown): number {
  return String((error as Error).message) === AUTH_ERROR ? 404 : 500;
}

function authMessage(error: unknown, fallback: string): string {
  return String((error as Error).message) === AUTH_ERROR
    ? "Not found."
    : String((error as Error).message || error) || fallback;
}

export async function GET() {
  try {
    await requireAdmin();
    const snapshot = await getFirebaseDb()
      .collection("blogTopics")
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();
    const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ ok: true, items });
  } catch (error) {
    return NextResponse.json(
      { error: authMessage(error, "Unable to load automation topics.") },
      { status: authStatus(error) }
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const topic = String(body.topic || "").trim();
    if (!topic) return NextResponse.json({ error: "Topic is required" }, { status: 400 });

    const now = new Date().toISOString();
    const record = {
      topic,
      notes: String(body.notes || "").trim(),
      featuredImageUrl: body.featuredImageUrl ? String(body.featuredImageUrl).trim() : null,
      source: body.source === "ai" ? "ai" : "manual",
      status: "pending",
      createdAt: now,
      publishedArticleId: null,
      failureReason: null,
      modelUsed: null,
    };

    const docRef = await getFirebaseDb().collection("blogTopics").add(record);
    return NextResponse.json({ ok: true, item: { id: docRef.id, ...record } });
  } catch (error) {
    return NextResponse.json(
      { error: authMessage(error, "Unable to create automation topic.") },
      { status: authStatus(error) }
    );
  }
}