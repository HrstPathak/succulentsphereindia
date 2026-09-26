#!/usr/bin/env node
/**
 * Reports the open-tag stack at chosen anchor strings, so a structural bug in
 * the generated HTML can be seen in the source rather than guessed at from a
 * screenshot.
 *
 * A screenshot is actively misleading for this class of bug. A wrapper
 * <tr><td> that the HTML parser silently discards still leaves the message
 * looking broadly correct - the block simply renders edge-to-edge instead of
 * inset - so the only reliable signal is the tag nesting itself. That is
 * exactly what happened when the items band was first given a padded wrapper
 * cell: the markup read correctly and the block still came out flush to the
 * card edge, because the HTML5 parser closes an enclosing <table> as soon as
 * it meets a nested one.
 *
 * Usage:
 *   npm run order:email:build
 *   node email-preview/probe-layout.cjs     (writes render/probe.local.html)
 *   node email-preview/probe-structure.cjs
 */

const fs = require("node:fs");
const path = require("node:path");

const file = path.join(__dirname, "render", "probe.local.html");
// Strip comments, including the [if mso] ones: the browser never parses their
// contents either, so leaving them in would misreport the stack.
const html = fs.readFileSync(file, "utf8").replace(/<!--[\s\S]*?-->/g, "");

const re = /<(\/?)(table|tbody|thead|tr|td|div)\b[^>]*>/gi;
// Every block that is meant to sit inside the white card.
const ANCHORS = [
  "Hi Rose maria,",
  "CUSTOMER",
  "Items ordered",
  "PRODUCT",
  "DELIVERY ADDRESS",
  "Order summary",
  "Track your order",
];

// Record the open-tag stack as it evolves, then resolve each anchor against the
// last snapshot before it. Resolving by index rather than by "the 45 chars
// after a tag" matters: the anchor text usually sits well inside its element.
const snapshots = [{ at: 0, stack: [] }];
const stack = [];
let m;
while ((m = re.exec(html))) {
  const [, close, tag] = m;
  if (close) {
    const i = stack.lastIndexOf(tag);
    if (i >= 0) stack.length = i;
  } else {
    stack.push(tag);
  }
  snapshots.push({ at: m.index, stack: stack.slice() });
}

const stackAt = (index) => {
  let lo = 0;
  let hi = snapshots.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (snapshots[mid].at <= index) lo = mid;
    else hi = mid - 1;
  }
  return snapshots[lo].stack;
};

// "On the card" means the block sits inside a panel that is a direct child of
// the page background div, i.e. its chain begins div>table. Counting table
// levels instead would flag the greeting, which is the card's own cell and so
// legitimately sits at only one level — a false positive in a diagnostic is
// worse than none, because it teaches people to ignore the output.
let bad = 0;
console.log("block nesting - every block should sit under a panel (div>table...):\n");
for (const a of ANCHORS) {
  const at = html.indexOf(a);
  const s = at < 0 ? null : stackAt(at);
  const ok = !!s && s[0] === "div" && s[1] === "table";
  if (!ok) bad++;
  console.log(
    `  ${ok ? "OK      " : "ESCAPED"} ${a.padEnd(18)} ${(s || []).join(">") || "(not found)"}`,
  );
}
process.exitCode = bad ? 1 : 0;
