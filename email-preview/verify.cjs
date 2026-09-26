#!/usr/bin/env node
/**
 * Verifies the order status email before it goes anywhere near a real inbox.
 *
 * These are the failure modes that actually bite in production, and none of
 * them are caught by a type check:
 *   - unbalanced tables, which make Outlook render the whole email sideways
 *   - unresolved template tokens
 *   - inline <svg>, which Gmail strips and Outlook cannot draw
 *   - a WebP hero, which Outlook 2007-2021 and Windows Mail cannot decode
 *   - images with no width/height, which cause layout shift while loading
 *   - exceeding Gmail's 102KB clipping threshold
 *   - the tracking panel rendering for a status that has nothing to track
 *   - the plain-text part drifting away from the HTML copy
 *
 * Usage:
 *   npx tsc src/lib/email-templates/orderStatus.ts --outDir email-preview/render \
 *     --module commonjs --target ES2019 --skipLibCheck --lib es2020,dom
 *   node email-preview/verify.cjs
 */
const fs = require("node:fs");
const path = require("node:path");

const { buildOrderStatusEmail } = require("./render/orderStatus.js");

const STATUSES = ["IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"];
const MOVING = ["IN_TRANSIT", "OUT_FOR_DELIVERY"];
const GMAIL_CLIP_BYTES = 102400;

let pass = 0;
const failures = [];

function check(name, condition, detail) {
  if (condition) {
    pass += 1;
    return;
  }
  failures.push(detail ? `${name} ??? ${detail}` : name);
}

function count(haystack, needle) {
  return haystack.split(needle).length - 1;
}

/**
 * Tag counting has to run against the markup only. The <style> block and the
 * HTML comments legitimately mention tags in prose, and a naive substring count
 * reports those as unbalanced markup.
 */
function markup(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");
}

const VOID = new Set(["img", "br", "hr", "meta", "link", "input", "area", "col", "source", "wbr"]);

/**
 * Walks table/row/cell tags and reports the first structural problem, so a
 * mis-nested template fails here with a readable message instead of shipping
 * an email that renders sideways in Outlook.
 */
function walkNesting(body) {
  const stack = [];
  const result = { error: null, cellWithoutRow: false, rowWithoutTable: false };
  const re = /<(\/?)([a-z]+)\b[^>]*?(\/?)>/gi;
  let m;

  while ((m = re.exec(body)) !== null) {
    const [, slash, rawTag, selfClose] = m;
    const tag = rawTag.toLowerCase();
    if (VOID.has(tag) || selfClose === "/") continue;

    if (slash) {
      const open = stack.pop();
      if (!open) {
        result.error = `stray closing </${tag}>`;
        return result;
      }
      if (open !== tag) {
        result.error = `</${tag}> closes an open <${open}>`;
        return result;
      }
      continue;
    }

    if (tag === "td" && !stack.includes("tr")) result.cellWithoutRow = true;
    if (tag === "tr" && !stack.includes("table")) result.rowWithoutTable = true;
    stack.push(tag);
  }

  if (stack.length) result.error = `unclosed <${stack[stack.length - 1]}>`;
  return result;
}

const assetsDir = path.join(__dirname, "..", "public", "images", "email");
const base = {
  orderNumber: 1009,
  customerName: "Harshit Pathak",
  trackingNumber: "1234567890123",
  trackingUrl: "https://www.delhivery.com/track/package/1234567890123",
  carrier: "Delhivery",
};

for (const status of STATUSES) {
  const { subject, html, text } = buildOrderStatusEmail({
    ...base,
    status,
    amountDue: status === "OUT_FOR_DELIVERY" ? 249 : 0,
  });

  // --- Structure ---------------------------------------------------------
  const body = markup(html);
  const openTables = count(body, "<table");
  const closeTables = count(body, "</table>");
  check(`${status}: tables balanced`, openTables === closeTables, `${openTables} open vs ${closeTables} close`);

  const openTr = count(body, "<tr");
  const closeTr = count(body, "</tr>");
  check(`${status}: rows balanced`, openTr === closeTr, `${openTr} open vs ${closeTr} close`);

  const openTd = count(body, "<td");
  const closeTd = count(body, "</td>");
  check(`${status}: cells balanced`, openTd === closeTd, `${openTd} open vs ${closeTd} close`);

  // Counts alone are too weak: they cannot tell "<td> inside <tr>" from
  // "<td> loose after </tr>". Outlook drops the loose cell and the row collapses,
  // which is exactly how a hero photo ends up detached from its text. Walk the
  // tags and assert real nesting instead.
  const nesting = walkNesting(body);
  check(`${status}: tags nest correctly`, nesting.error === null, nesting.error);
  check(`${status}: no stray cell outside a row`, !nesting.cellWithoutRow, "a <td> is not inside a <tr>");
  check(`${status}: no row outside a table`, !nesting.rowWithoutTable, "a <tr> is not inside a <table>");

  // --- Content correctness ----------------------------------------------
  check(`${status}: no unresolved tokens`, !/\{\{|\}\}/.test(html), "template token left in output");
  check(`${status}: no undefined leaked`, !/undefined|\[object Object\]/.test(html));
  check(`${status}: preheader is first in body`, html.indexOf("display:none;max-height:0") < html.indexOf("<table"));
  check(`${status}: order number present`, html.includes("#1009"));
  check(`${status}: customer name present`, html.includes("Harshit Pathak"));
  check(`${status}: subject references order`, subject.includes("#1009"));

  // --- Client safety -----------------------------------------------------
  check(`${status}: no inline svg`, !/<svg/i.test(html), "Gmail strips inline svg");
  check(`${status}: hero is jpeg`, /hero-email\.jpg/i.test(html), "Outlook cannot decode webp");
  check(`${status}: no webp anywhere`, !/\.webp/i.test(html));

  const imgs = html.match(/<img\b[^>]*>/gi) || [];
  check(`${status}: images present`, imgs.length > 0);
  for (const img of imgs) {
    check(`${status}: img has width`, /\bwidth="\d+"/.test(img), img.slice(0, 90));
    check(`${status}: img has height`, /\bheight="\d+"/.test(img), img.slice(0, 90));
    check(`${status}: img has alt`, /\balt="/.test(img), img.slice(0, 90));
    check(`${status}: img is absolute url`, /src="https?:\/\//.test(img), img.slice(0, 90));
  }

  // Every referenced asset must actually exist on disk.
  const refs = [...html.matchAll(/\/images\/email\/([\w.-]+)/g)].map((m) => m[1]);
  check(`${status}: references assets`, refs.length > 0);
  for (const file of new Set(refs)) {
    check(`${status}: asset exists ${file}`, fs.existsSync(path.join(assetsDir, file)));
  }

  // The status pill and CTA must survive a client with no gradient support.
  check(
    `${status}: pill has solid bgcolor`,
    /bgcolor="#[0-9a-f]{6}"[\s\S]{0,200}border-radius:999px/i.test(html),
  );
  check(`${status}: cta has solid bgcolor`, /<td align="center" bgcolor="#2F4D3F"/.test(html));

  // --- Tracking panel ----------------------------------------------------
  const hasPanel = /TRACKING NUMBER/.test(html);
  if (MOVING.includes(status)) {
    check(`${status}: tracking panel shown`, hasPanel);
    check(`${status}: tracking number shown`, html.includes("1234567890123"));
  } else {
    check(`${status}: tracking panel omitted`, !hasPanel, "terminal state must not show tracking");
  }

  // --- Plain text --------------------------------------------------------
  check(`${status}: text part non-empty`, text.trim().length > 200);
  check(`${status}: text has no html tags`, !/<[a-z/]/i.test(text));
  check(`${status}: text has no entities`, !/&(mdash|nbsp|bull|amp);/.test(text));
  check(`${status}: text has order number`, text.includes("#1009"));
  check(`${status}: text has cta url`, /https?:\/\/\S+/.test(text));
  if (MOVING.includes(status)) {
    check(`${status}: text has tracking`, text.includes("1234567890123"));
  }

  // --- Gmail clipping ---------------------------------------------------
  const bytes = Buffer.byteLength(html, "utf8");
  check(`${status}: under Gmail 102KB clip`, bytes < GMAIL_CLIP_BYTES, `${(bytes / 1024).toFixed(1)}KB`);
  console.log(
    `${status.padEnd(18)} html ${(bytes / 1024).toFixed(1).padStart(5)}KB  text ${(Buffer.byteLength(text) / 1024).toFixed(1)}KB  "${subject}"`,
  );
}

// Terminal states must still offer a way back into the shop.
for (const status of ["DELIVERED", "CANCELLED"]) {
  const { html } = buildOrderStatusEmail({ ...base, status });
  check(`${status}: cta points at shop`, /collections\/all-succulents/.test(html));
}

console.log(`\n${pass} checks passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`  FAIL  ${f}`);
  process.exit(1);
}

// A checker that never fails is worse than no checker, so prove it bites by
// re-running the structural checks against deliberately broken markup.
if (process.env.SELFTEST) {
  const broken = {
    "unclosed cell": '<table><tr><td>copy</tr></table>',
    "cell outside a row": "<table></tr><td>copy</td></tr></table>",
    "row outside a table": "<tr><td>copy</td></tr>",
    "crossed tags": "<table><tr><td>copy</table></tr>",
  };
  let caught = 0;
  for (const [name, html] of Object.entries(broken)) {
    const n = walkNesting(markup(html));
    const bad = n.error !== null || n.cellWithoutRow || n.rowWithoutTable;
    console.log(`  selftest ${bad ? "caught" : "MISSED"}  ${name}${bad ? ` (${n.error})` : ""}`);
    if (bad) caught += 1;
  }
  if (caught !== Object.keys(broken).length) {
    console.log(`\nselftest FAILED: caught ${caught}/${Object.keys(broken).length}`);
    process.exit(1);
  }
  console.log(`selftest ok: caught ${caught}/${Object.keys(broken).length}`);
}
