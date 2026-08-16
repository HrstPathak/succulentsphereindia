/**
 * Firestore trigger helper intended to be copied into a Firebase Functions project.
 *
 * Usage:
 * - Copy this file into functions/src/onProductWrite.js (or index.js) in a Firebase Functions repo
 * - Ensure functions/package.json includes firebase-admin, firebase-functions and node-fetch
 * - Set env vars in the Functions runtime: GENERATE_ENDPOINT and META_GENERATE_SECRET
 * - Deploy with `firebase deploy --only functions:onProductWrite`
 *
 * The trigger will POST to the provided GENERATE_ENDPOINT to request regeneration of the CSV.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fetch = require("node-fetch");

if (!admin.apps.length) admin.initializeApp();

exports.onProductWrite = functions.firestore.document("products/{id}").onWrite(async (change, context) => {
  const endpoint = process.env.GENERATE_ENDPOINT;
  const secret = process.env.META_GENERATE_SECRET;
  if (!endpoint || !secret) {
    console.info("onProductWrite: GENERATE_ENDPOINT or META_GENERATE_SECRET not configured, skipping trigger call");
    return null;
  }

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Authorization": `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({ productId: context.params.id }),
      // node-fetch v2 supports timeout option
      timeout: 15000,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.info(`onProductWrite: generator returned ${res.status} ${text}`);
    } else {
      console.info("onProductWrite: generator triggered successfully");
    }
  } catch (e) {
    console.info("onProductWrite: failed to call generator:", String(e?.message || e));
  }

  return null;
});
