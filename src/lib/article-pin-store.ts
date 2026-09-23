import "server-only";

import type { Firestore } from "firebase-admin/firestore";
import { MAX_PINNED_ARTICLES, comparePinnedOrder, type PinnedOrderEntry } from "@/lib/article-pinning";

/** Thrown when an admin tries to pin more blogs than the rail can hold. */
export class PinLimitError extends Error {
  constructor() {
    super(`You can pin up to ${MAX_PINNED_ARTICLES} blogs to the home page. Unpin one to free a slot.`);
    this.name = "PinLimitError";
  }
}

function toEntry(id: string, data: Record<string, unknown>): PinnedOrderEntry {
  return {
    id,
    pinnedOrder: data.pinnedOrder === null || data.pinnedOrder === undefined ? undefined : Number(data.pinnedOrder),
    pinnedAt: String(data.pinnedAt || data.publishedAt || ""),
  };
}

/** Every pinned blog id, ordered exactly as the home page rail renders them. */
export async function readPinnedArticleIds(db: Firestore): Promise<string[]> {
  const snapshot = await db
    .collection("articles")
    .where("pinned", "==", true)
    .limit(MAX_PINNED_ARTICLES * 5)
    .get();
  return snapshot.docs
    .map((doc) => toEntry(doc.id, doc.data() as Record<string, unknown>))
    .sort(comparePinnedOrder)
    .map((entry) => entry.id);
}

/**
 * Refuse a new pin once every slot is taken. `articleId` is excluded so
 * re-saving an already pinned blog never counts against the cap.
 */
export async function assertPinCapacity(db: Firestore, articleId?: string): Promise<void> {
  const pinned = await readPinnedArticleIds(db);
  const others = articleId ? pinned.filter((id) => id !== articleId) : pinned;
  if (others.length >= MAX_PINNED_ARTICLES) throw new PinLimitError();
}

/**
 * Atomically rewrite `pinnedOrder` to 0..n-1 for these ids. Deleted docs are
 * skipped so one stale id can never fail the whole reorder.
 */
export async function writePinnedOrder(db: Firestore, ids: string[]): Promise<void> {
  const refs = ids.slice(0, MAX_PINNED_ARTICLES).map((id) => db.collection("articles").doc(id));
  if (!refs.length) return;
  const docs = await db.getAll(...refs);
  const batch = db.batch();
  let position = 0;
  for (const doc of docs) {
    if (!doc.exists) continue;
    batch.update(doc.ref, { pinnedOrder: position });
    position += 1;
  }
  if (!position) return;
  await batch.commit();
}

/** Pin a blog to the top of the rail, keeping every other pin in its current order. */
export async function pinArticleToTop(db: Firestore, articleId: string): Promise<void> {
  const others = (await readPinnedArticleIds(db)).filter((id) => id !== articleId);
  await writePinnedOrder(db, [articleId, ...others]);
}

/** Re-number the remaining pins after an unpin so the rail has no gaps. */
export async function compactPinnedOrder(db: Firestore): Promise<void> {
  await writePinnedOrder(db, await readPinnedArticleIds(db));
}
