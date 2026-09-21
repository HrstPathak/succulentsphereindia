/**
 * Dev-only verification harness (Chrome DevTools Protocol).
 *
 * Checks the two behaviours changed in this task:
 *  1. An article page whose content HTML is a full document renders the whole
 *     article inline: the frame grows to its content, the inner document has no
 *     scroll overflow left, and the surrounding page is the scroll container.
 *  2. The guest wishlist hydrates: with ids in localStorage (and no session
 *     cookie) the /wishlist grid renders real product rows.
 *
 * Usage: start the app on :3000, start Chrome with --remote-debugging-port=9222,
 * then `node tmp/cdp-verify.cjs`.
 */
const PORT = process.env.CDP_PORT || 9222;
const BASE = process.env.BASE_URL || "http://localhost:3000";
const ARTICLE = "/plant-care/why-is-my-succulent-dying-10-problems-fixes-for-indian-homes-2026";

// Node 20 has no global WebSocket; `ws` ships with the toolchain (Next).
const WebSocketImpl = globalThis.WebSocket || require("ws");

const GUEST_IDS = [
  "bunny-ear-yellow-cactus-opuntia-red-polka-dot-decorative-cactus",
  "cathedral-window-haworthia",
  "austrocephalocereus-dybowskii-cactus",
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function pageTarget() {
  const response = await fetch(`http://127.0.0.1:${PORT}/json/list`);
  const targets = await response.json();
  const target = targets.find((item) => item.type === "page" && item.webSocketDebuggerUrl);
  if (!target) throw new Error("No debuggable page target found.");
  return target;
}

class Client {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 0;
    this.pending = new Map();
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (!message.id || !this.pending.has(message.id)) return;
      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
    };
  }

  send(method, params = {}) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) {
      throw new Error(JSON.stringify(result.exceptionDetails.exception?.description || result.exceptionDetails));
    }
    return result.result?.value;
  }

  async goto(url, settleMs = 2500) {
    await this.send("Page.navigate", { url });
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const ready = await this.evaluate("document.readyState").catch(() => null);
      if (ready === "complete") break;
      await sleep(500);
    }
    await sleep(settleMs);
  }
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocketImpl(url);
    socket.onopen = () => resolve(new Client(socket));
    socket.onerror = (error) => reject(error);
  });
}

const ARTICLE_PROBE = `(() => {
  const frame = document.querySelector("iframe");
  if (!frame) return { error: "no iframe rendered" };
  const doc = frame.contentDocument;
  const root = doc?.documentElement;
  const body = doc?.body;
  return {
    frameHeight: Math.round(frame.getBoundingClientRect().height),
    frameInlineHeight: frame.style.height || null,
    frameClientHeight: frame.clientHeight,
    frameWidth: frame.clientWidth,
    innerScrollHeight: root ? root.scrollHeight : null,
    innerClientHeight: root ? root.clientHeight : null,
    innerOverflow: root ? root.scrollHeight - root.clientHeight : null,
    bodyScrollHeight: body ? body.scrollHeight : null,
    bodyOffsetHeight: body ? body.offsetHeight : null,
    innerScrollbarCss: doc ? Boolean(doc.querySelector("style[data-ss-article-frame]")) : null,
    pageScrollHeight: document.documentElement.scrollHeight,
    pageViewportHeight: window.innerHeight,
    pageScrollable: document.documentElement.scrollHeight > window.innerHeight + 8,
    heroText: doc ? doc.body.innerText.slice(0, 40).replace(/\\s+/g, " ") : null,
    tailText: doc ? doc.body.innerText.slice(-70).replace(/\\s+/g, " ") : null,
    headerPosition: getComputedStyle(document.querySelector("header")).position,
  };
})()`;

const WISHLIST_PROBE = `(() => {
  const rows = Array.from(document.querySelectorAll("article")).map((row) => row.innerText.split("\\n")[0]);
  const wishlistRequests = performance
    .getEntriesByType("resource")
    .filter((entry) => entry.name.includes("/api/wishlist"))
    .map((entry) => ({ status: entry.responseStatus, start: Math.round(entry.startTime), duration: Math.round(entry.duration) }));
  return {
    rowCount: rows.length,
    firstRow: rows[0] || null,
    showsSkeleton: Boolean(document.querySelector('[aria-label="Loading your wishlist"]')),
    showsEmptyState: document.body.innerText.includes("Your wishlist is empty"),
    countLine: (document.body.innerText.match(/\\d+ items? saved for later/) || [null])[0],
    wishlistRequests,
  };
})()`;

(async () => {
  const target = await pageTarget();
  const client = await connect(target.webSocketDebuggerUrl);
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

  console.log("=== 1) article page (full HTML document content) ===");
  await client.goto(`${BASE}${ARTICLE}`, 6000);
  console.log(JSON.stringify(await client.evaluate(ARTICLE_PROBE), null, 2));

  console.log("=== 2) viewport changes re-measure the frame ===");
  const timeline = [];
  await client.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  for (let tick = 1; tick <= 10; tick += 1) {
    await sleep(700);
    const sample = await client.evaluate(
      `(() => { const f = document.querySelector("iframe"); const d = f.contentDocument; return { t: ${tick}, inline: f.style.height, frame: f.clientHeight, rootScroll: d.documentElement.scrollHeight, rootClient: d.documentElement.clientHeight, overflow: d.documentElement.scrollHeight - d.documentElement.clientHeight }; })()`
    );
    timeline.push(sample);
  }
  console.log(JSON.stringify(timeline, null, 1));
  const desktop = await client.evaluate(ARTICLE_PROBE);
  console.log(JSON.stringify({ frameWidth: desktop.frameWidth, frameHeight: desktop.frameHeight, bodyHeight: desktop.bodyOffsetHeight, innerOverflow: desktop.innerOverflow }, null, 2));

  await client.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await sleep(3000);
  const backToMobile = await client.evaluate(ARTICLE_PROBE);
  console.log(JSON.stringify({ frameWidth: backToMobile.frameWidth, frameHeight: backToMobile.frameHeight, bodyHeight: backToMobile.bodyOffsetHeight, innerOverflow: backToMobile.innerOverflow }, null, 2));

  console.log("=== 3) guest wishlist grid ===");
  await client.goto(`${BASE}/`, 1500);
  await client.evaluate(
    `(() => { localStorage.setItem("ss_wishlist_v1", JSON.stringify(${JSON.stringify(GUEST_IDS)})); sessionStorage.clear(); return true; })()`
  );
  await client.goto(`${BASE}/wishlist`, 6000);
  console.log(JSON.stringify(await client.evaluate(WISHLIST_PROBE), null, 2));

  console.log("=== 4) guest remove stays client-side (no refetch) ===");
  const requestsBefore = await client.evaluate(
    `performance.getEntriesByType("resource").filter((entry) => entry.name.includes("/api/wishlist")).length`
  );
  const clicked = await client.evaluate(
    `(() => { const button = document.querySelector('button[aria-label="Remove from wishlist"]'); if (!button) return false; button.click(); return true; })()`
  );
  await sleep(2500);
  const requestsAfter = await client.evaluate(
    `performance.getEntriesByType("resource").filter((entry) => entry.name.includes("/api/wishlist")).length`
  );
  console.log(JSON.stringify({
    clicked,
    requestsBefore,
    requestsAfter,
    ...(await client.evaluate(WISHLIST_PROBE)),
    storedIds: await client.evaluate(`localStorage.getItem("ss_wishlist_v1")`),
  }, null, 2));

  process.exit(0);
})().catch((error) => {
  console.error("verification failed:", error);
  process.exit(1);
});
