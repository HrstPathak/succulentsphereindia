/**
 * Product thumbnail pipeline.
 *
 * The behaviour that matters is failure containment: a dead image host, a 404,
 * a truncated file or a non-image body must cost that one row its thumbnail
 * and nothing else. A confirmation email that throws because a product photo
 * 404s is an order notification that never arrives, so every case below
 * asserts the send still produces a full set of items.
 */

const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");
const ts = require("typescript");

function loadTypeScript(file, mocks = {}) {
  const fs = require("node:fs");
  const source = fs.readFileSync(file, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: file,
  }).outputText;
  const loaded = new Module(file, module);
  loaded.filename = file;
  loaded.paths = Module._nodeModulePaths(path.dirname(file));
  if (Object.keys(mocks).length) {
    const originalLoad = Module._load;
    Module._load = function mockedLoad(request, parent, isMain) {
      if (Object.prototype.hasOwnProperty.call(mocks, request)) return mocks[request];
      return originalLoad.call(this, request, parent, isMain);
    };
    try {
      loaded._compile(output, file);
    } finally {
      Module._load = originalLoad;
    }
  } else {
    loaded._compile(output, file);
  }
  return loaded.exports;
}

/** A 1x1 red PNG, the smallest thing sharp will accept as an image. */
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const realFetch = global.fetch;

/** Serves `TINY_PNG` for every URL containing `match`, 404 for the rest. */
function serveOnly(match) {
  global.fetch = async (url) => {
    const href = String(url);
    if (href.includes(match)) {
      return new Response(TINY_PNG, {
        status: 200,
        headers: { "content-type": "image/png", "content-length": String(TINY_PNG.length) },
      });
    }
    return new Response("nope", { status: 404 });
  };
}

const { buildProductThumbnails } = loadTypeScript(
  path.join(process.cwd(), "src", "lib", "email-thumbnail.ts"),
  { "server-only": {} },
);

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test("a reachable image becomes a cid: reference and a JPEG attachment", async () => {
  serveOnly("good");
  const { items, attachments, skipped } = await buildProductThumbnails([
    { title: "Moonstone", image: "https://cdn.example.com/good.png" },
  ]);
  assert.equal(attachments.length, 1, "one attachment expected");
  assert.equal(skipped, 0, "nothing should be skipped");
  assert.equal(items[0].image, "cid:product-0", "item should point at the cid");
  assert.equal(attachments[0].cid, "product-0", "cid must match the reference");
  assert.equal(attachments[0].contentType, "image/jpeg", "thumbnails are re-encoded as JPEG");
  assert.ok(attachments[0].content.length > 0, "attachment must carry bytes");
  // A 1x1 source scaled to 128x128 still compresses small; the point is that
  // real content is re-encoded rather than passed through untouched.
  assert.equal(
    attachments[0].content.subarray(0, 2).toString("latin1"),
    "\xff\xd8",
    "must be a real JPEG (SOI marker), not the source PNG",
  );
});

test("a 404 costs that row its thumbnail and keeps the others", async () => {
  serveOnly("good");
  const { items, attachments, skipped } = await buildProductThumbnails([
    { title: "Broken", image: "https://cdn.example.com/missing.png" },
    { title: "Fine", image: "https://cdn.example.com/good.png" },
  ]);
  assert.equal(attachments.length, 1, "only the reachable image is embedded");
  assert.equal(skipped, 1, "the 404 is counted as skipped");
  assert.equal(items[0].image, "", "a failed row must not render a broken thumbnail");
  assert.equal(items[1].image, "cid:product-0", "the healthy row still gets its photo");
  assert.equal(items.length, 2, "no item may be dropped from the email");
});

test("a fetch that throws does not abort the send", async () => {
  global.fetch = async (url) => {
    if (String(url).includes("boom")) throw new Error("ECONNREFUSED");
    return new Response(TINY_PNG, { status: 200, headers: { "content-type": "image/png" } });
  };
  const { items, attachments, skipped } = await buildProductThumbnails([
    { title: "Down", image: "https://cdn.example.com/boom.png" },
    { title: "Fine", image: "https://cdn.example.com/other.png" },
  ]);
  assert.equal(attachments.length, 1);
  assert.equal(skipped, 1);
  assert.equal(items[0].image, "");
  assert.equal(items[1].image, "cid:product-0");
});

test("a non-image body is rejected rather than embedded as garbage", async () => {
  global.fetch = async () =>
    new Response("<html>404</html>", { status: 200, headers: { "content-type": "text/html" } });
  const { items, attachments, skipped } = await buildProductThumbnails([
    { title: "HTML", image: "https://cdn.example.com/page.png" },
  ]);
  assert.equal(attachments.length, 0, "HTML must not become an attachment");
  assert.equal(skipped, 1);
  assert.equal(items[0].image, "");
});

test("an oversized body is refused before it is buffered", async () => {
  global.fetch = async () =>
    // Declares 40 MB in the header; the guard must reject on the header alone.
    new Response(TINY_PNG, {
      status: 200,
      headers: { "content-length": String(40 * 1024 * 1024) },
    });
  const { attachments, skipped } = await buildProductThumbnails([
    { title: "Huge", image: "https://cdn.example.com/huge.png" },
  ]);
  assert.equal(attachments.length, 0);
  assert.equal(skipped, 1);
});

test("identical URLs are embedded once and shared", async () => {
  serveOnly("same");
  const { items, attachments } = await buildProductThumbnails([
    { title: "A", image: "https://cdn.example.com/same.png" },
    { title: "B", image: "https://cdn.example.com/same.png" },
  ]);
  assert.equal(attachments.length, 1, "the bytes should only be sent once");
  assert.equal(items[0].image, items[1].image, "both rows share one cid");
});

test("non-http schemes are dropped, never rendered as a thumbnail", async () => {
  let fetched = 0;
  global.fetch = async () => {
    fetched += 1;
    return new Response(TINY_PNG, { status: 200 });
  };
  const { items, attachments } = await buildProductThumbnails([
    { title: "Data URI", image: "data:image/png;base64,AAAA" },
    { title: "Relative", image: "/images/plant.png" },
    { title: "JS", image: "javascript:alert(1)" },
  ]);
  assert.equal(attachments.length, 0);
  assert.equal(fetched, 0, "these must never reach the network");
  for (const item of items) assert.equal(item.image, "", `expected empty for ${item.title}`);
});

test("items with no image at all are left alone and cost no fetch", async () => {
  let fetched = 0;
  global.fetch = async () => {
    fetched += 1;
    return new Response(TINY_PNG, { status: 200 });
  };
  const { items, attachments } = await buildProductThumbnails([
    { title: "No photo" },
    { title: "Blank", image: "   " },
  ]);
  assert.equal(attachments.length, 0);
  assert.equal(fetched, 0);
  assert.equal(items.length, 2);
  assert.equal(items[0].image, "");
});

test("the thumbnail cap keeps a huge cart from bloating the message", async () => {
  serveOnly("p");
  const items = Array.from({ length: 14 }, (_, i) => ({
    title: `P${i}`,
    image: `https://cdn.example.com/p${i}.png`,
  }));
  const { attachments, skipped } = await buildProductThumbnails(items);
  assert.equal(attachments.length, 8, "capped at 8 inline images");
  assert.equal(skipped, 6, "the overflow rows are reported as skipped");
});

(async () => {
  let failed = 0;
  for (const [name, fn] of tests) {
    global.fetch = realFetch;
    try {
      await fn();
      console.log(`  ok  ${name}`);
    } catch (error) {
      failed += 1;
      console.error(`  FAIL  ${name}`);
      console.error(`        ${error.message}`);
    }
  }
  global.fetch = realFetch;
  console.log(
    failed
      ? `\nthumbnail smoke test: ${failed} of ${tests.length} failed`
      : `\nthumbnail smoke test passed (${tests.length} cases)`,
  );
  process.exitCode = failed ? 1 : 0;
})();
