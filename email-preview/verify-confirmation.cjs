#!/usr/bin/env node
/**
 * Verifies the order confirmation email before it goes anywhere near a real
 * inbox.
 *
 * These are the failure modes that actually bite in production, and none of
 * them are caught by a type check:
 *   - unbalanced tables, which make Outlook render the whole email sideways
 *   - inline <svg>, which Gmail strips and Outlook cannot draw
 *   - a WebP hero, which Outlook 2007-2021 and Windows Mail cannot decode
 *   - images with no width/height, which cause layout shift while loading
 *   - an asset referenced but never committed, which 404s in a real inbox
 *   - exceeding Gmail's 102KB clipping threshold
 *   - the plain-text part drifting away from the HTML
 *
 * And the one specific to this template — the cash-on-delivery split. A
 * confirmation email that says "Rs 0 due" on a COD order, or prints an advance
 * and a balance that do not add up to the order total, sends a customer to the
 * door with the wrong amount of cash. Those are checked arithmetically against
 * the rendered HTML rather than by eye, because the whole point of that block
 * is that it is easy to get subtly wrong and impossible to notice by reading.
 *
 * Usage:
 *   npm run order:confirmation:verify
 */
const fs = require("node:fs");
const path = require("node:path");

const {
  buildOrderConfirmationEmail,
  buildAdminOrderAlertEmail,
} = require("./render/orderConfirmation.js");

const GMAIL_CLIP_BYTES = 102400;

let pass = 0;
const failures = [];

function check(name, condition, detail) {
  if (condition) {
    pass += 1;
    return;
  }
  failures.push(detail ? `${name} >>> ${detail}` : name);
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

/** Walks table/row/cell tags and reports the first structural problem. */
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

/**
 * Pulls the first rupee amount that follows `label` in the rendered HTML.
 *
 * Matches the literal U+20B9 as well as the &#8377; entity: formatInr() comes
 * from Intl and emits the real character, while some blocks hand-write the
 * entity. Accepting both means this check keeps working whichever a future
 * edit chooses.
 */
function amountAfter(html, label) {
  const at = html.indexOf(label);
  if (at < 0) return null;
  const hit = /(?:₹|&#8377;)([\d,]+\.?\d*)/.exec(html.slice(at, at + 400));
  if (!hit) return null;
  return Number(hit[1].replace(/,/g, ""));
}

/** True when the amount is present as literal text a reader can select. */
function showsAmount(html, amount) {
  if (amount === null || amount === undefined) return false;
  const formatted = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount);
  return html.includes(formatted) || html.includes(`₹${amount.toFixed(2)}`);
}

const assetsDir = path.join(__dirname, "..", "public", "images", "email");

// A prepaid order matching the reference design, and the partial-COD order
// this business actually runs: Rs 100 up front, the balance at the door.
const BASE = {
  orderId: "o1",
  orderNumber: 1014,
  customerName: "Rose maria",
  customerEmail: "rosemariaofficial04@gmail.com",
  phone: "9778398376",
  address: "Vellookunnel house, thazepathinaramkandom",
  city: "murickassery p o",
  state: "Kerala",
  pincode: "685604",
  items: [
    {
      title: "Pink Moonstone (Pachyphytum oviferum) - Pearl Pink Egg Leaf",
      quantity: 3,
      price: 139,
      image: "https://cdn.example.com/products/pink-moonstone.jpg",
    },
    {
      title: "Moonstone (Pachyphytum oviferum) - Pearl White Egg Leaf",
      quantity: 3,
      price: 79,
      image: "https://cdn.example.com/products/moonstone.jpg",
    },
  ],
  shipping: 0,
  discount: 0,
  codFee: 0,
};

/**
 * Every payment shape the confirmation email has to render correctly. `paid`
 * and `due` are the expected panel figures, asserted against the HTML rather
 * than trusted, and the `isCod` flag states whether the COD panel should be
 * present at all.
 */
const SCENARIOS = [
  {
    // The production path: thumbnails arrive already rewritten to cid:
    // references by buildProductThumbnails, with the bytes attached to the
    // message. This is the one that has to work, because Gmail will not fetch
    // a remote image until the reader clicks through.
    name: "cod_deposit_inline_thumbs",
    input: {
      ...BASE,
      total: 724,
      paymentMode: "cod_deposit",
      codDepositAmount: 100,
      paymentReceived: 100,
      codBalance: 624,
      codFee: 50,
      items: [
        { ...BASE.items[0], image: "cid:product-0" },
        { ...BASE.items[1], image: "cid:product-1" },
      ],
    },
    isCod: true,
    paid: 100,
    due: 624,
  },
  {
    // A row whose image cannot resolve must render no thumbnail cell at all,
    // rather than an empty box the reader has to interpret.
    name: "cod_deposit_unusable_image",
    input: {
      ...BASE,
      total: 724,
      paymentMode: "cod_deposit",
      codDepositAmount: 100,
      paymentReceived: 100,
      codBalance: 624,
      codFee: 50,
      items: [
        { ...BASE.items[0], image: "data:image/png;base64,AAAA" },
        { ...BASE.items[1], image: "" },
      ],
    },
    isCod: true,
    paid: 100,
    due: 624,
  },
  {
    name: "prepaid",
    input: { ...BASE, total: 654, paymentMode: "prepaid", paymentReceived: 654 },
    isCod: false,
    paid: 654,
    due: 0,
  },
  {
    name: "cod_deposit",
    input: {
      ...BASE,
      total: 724,
      paymentMode: "cod_deposit",
      codDepositAmount: 100,
      paymentReceived: 100,
      codBalance: 624,
      codFee: 50,
    },
    isCod: true,
    paid: 100,
    due: 624,
  },
  {
    name: "cod_full",
    input: { ...BASE, total: 724, paymentMode: "cod", codFee: 50 },
    isCod: true,
    paid: 0,
    due: 724,
  },
  {
    name: "cod_deposit_with_wallet",
    input: {
      ...BASE,
      total: 724,
      paymentMode: "cod_deposit",
      codDepositAmount: 100,
      paymentReceived: 100,
      codBalance: 574,
      walletAmountUsed: 50,
      codFee: 50,
    },
    isCod: true,
    paid: 150,
    due: 574,
  },
  {
    // A COD order whose deposit happens to cover the whole total. Everything
    // else in this codebase reports that as Prepaid, so the email must too.
    name: "cod_fully_covered",
    input: {
      ...BASE,
      total: 100,
      paymentMode: "cod_deposit",
      codDepositAmount: 100,
      paymentReceived: 100,
      codBalance: 0,
    },
    isCod: false,
    paid: 100,
    due: 0,
  },
  {
    name: "admin_test",
    input: { ...BASE, total: 654, paymentMode: "admin_test" },
    isCod: false,
    paid: 0,
    due: 0,
  },
];

for (const scenario of SCENARIOS) {
  const { name, input } = scenario;
  const { subject, preheader, html, text } = buildOrderConfirmationEmail(input);

  // --- Structure ---------------------------------------------------------
  const body = markup(html);
  const openTables = count(body, "<table");
  const closeTables = count(body, "</table>");
  check(`${name}: tables balanced`, openTables === closeTables, `${openTables} open vs ${closeTables} close`);

  const openRows = count(body, "<tr");
  const closeRows = count(body, "</tr>");
  check(`${name}: rows balanced`, openRows === closeRows, `${openRows} open vs ${closeRows} close`);

  const openCells = count(body, "<td");
  const closeCells = count(body, "</td>");
  check(`${name}: cells balanced`, openCells === closeCells, `${openCells} open vs ${closeCells} close`);

  const nest = walkNesting(body);
  check(`${name}: nesting valid`, !nest.error, nest.error || "");
  check(`${name}: no cell outside a row`, !nest.cellWithoutRow);
  check(`${name}: no row outside a table`, !nest.rowWithoutTable);

  // --- Images ------------------------------------------------------------
  check(`${name}: no inline svg`, !/<svg[\s>]/i.test(html));
  check(`${name}: no webp`, !/\.webp/i.test(html), "Outlook 2007-2021 cannot decode WebP");

  const imgs = html.match(/<img\b[^>]*>/gi) || [];
  check(`${name}: images present`, imgs.length > 0);
  for (const img of imgs) {
    check(`${name}: img has width`, /\bwidth="\d+"/.test(img), img.slice(0, 90));
    check(`${name}: img has height`, /\bheight="\d+"/.test(img), img.slice(0, 90));
    check(`${name}: img has alt`, /\balt="/.test(img), img.slice(0, 90));
  }

  // Every referenced asset must actually exist on disk, or it 404s in a real
  // inbox where nothing is watching for it.
  const refs = [...html.matchAll(/\/images\/email\/([\w.-]+)/g)].map((m) => m[1]);
  check(`${name}: references assets`, refs.length > 0);
  for (const file of new Set(refs)) {
    check(`${name}: asset exists ${file}`, fs.existsSync(path.join(assetsDir, file)));
  }

  // --- Product thumbnails ------------------------------------------------
  // A `cid:` reference is what production sends: Gmail blocks remote images
  // until the reader clicks through, so the bytes are attached to the message
  // instead. A raw https URL still has to render, for callers that have not
  // prepared attachments. Either way exactly one 64px cell per image-bearing
  // item, and never a cell for an image that cannot resolve.
  const cids = [...html.matchAll(/src="cid:([^"]+)"/g)].map((m) => m[1]);
  const imageItems = scenario.input.items.filter((i) =>
    /^(?:https?:\/\/|cid:)/i.test(String(i.image || "").trim()),
  );
  // Count the <img> tags, not the attribute pairs: the 64x64 cell repeats
  // width/height on both its <td> and its <img>, so matching the raw attribute
  // string counts every thumbnail twice.
  const thumbCells = (html.match(/<img\b[^>]*\bwidth="64"[^>]*>/gi) || []).length;

  check(
    `${name}: one thumbnail cell per image-bearing item`,
    thumbCells === imageItems.length,
    `${thumbCells} cells vs ${imageItems.length} image-bearing items`,
  );
  check(
    `${name}: every item image resolves to a cell`,
    imageItems.length === thumbCells,
    `${imageItems.length} image items, ${thumbCells} cells`,
  );
  for (const cid of new Set(cids)) {
    check(`${name}: cid is a bare token`, /^[A-Za-z0-9._-]+$/.test(cid), cid);
  }

  // The hero must be declared three ways, or one class of client sees no photo.
  check(`${name}: hero background attr`, /background="https?:\/\/[^"]*hero-confirmation\.jpg"/.test(html));
  check(`${name}: hero css background`, /background-image:url\('https?:\/\/[^']*hero-confirmation\.jpg'\)/.test(html));
  check(
    `${name}: hero vml fallback`,
    /<v:rect[\s\S]{0,400}?<v:fill[^>]*src="[^"]*hero-confirmation\.jpg"/.test(html),
  );

  // --- The cash-on-delivery split ---------------------------------------
  // The two halves are separate cells, so the gap between the labels spans one
  // amount plus a closing and an opening cell. The bound is generous on
  // purpose: a tighter one silently starts failing the moment a font size or a
  // currency string grows, which is the wrong way for a safety check to break.
  const hasPanel = /PAID NOW[\s\S]{0,900}DUE ON DELIVERY/.test(html);
  check(`${name}: cod panel ${scenario.isCod ? "shown" : "omitted"}`, hasPanel === scenario.isCod);

  if (scenario.isCod) {
    const paid = amountAfter(html, "PAID NOW");
    const due = amountAfter(html, "DUE ON DELIVERY");
    check(`${name}: panel paid amount`, paid === scenario.paid, `got ${paid}, want ${scenario.paid}`);
    check(`${name}: panel due amount`, due === scenario.due, `got ${due}, want ${scenario.due}`);

    // The arithmetic invariant: what is taken now plus what is due at the door
    // must be exactly the order total. If these drift, the courier and the
    // customer disagree about money with the parcel in the room.
    check(
      `${name}: paid + due === total`,
      paid !== null && due !== null && Math.abs(paid + due - input.total) < 0.01,
      `${paid} + ${due} != ${input.total}`,
    );

    // Both figures must survive as selectable text, not only as the bar: the
    // bar is the part a client is most likely to drop.
    check(`${name}: paid is selectable text`, showsAmount(html, paid));
    check(`${name}: due is selectable text`, showsAmount(html, due));
    check(`${name}: summary has payable row`, /Payable on delivery/.test(html));
    check(
      `${name}: preheader states the split`,
      /received/i.test(preheader) && /pay when your plants arrive/i.test(preheader),
      preheader,
    );
    check(`${name}: text states the split`, /Due on delivery:\s*₹/.test(text) && /Paid now:\s*₹/.test(text));
  } else {
    check(`${name}: no "due on delivery" claim`, !/DUE ON DELIVERY/i.test(html));
    check(`${name}: no payable row`, !/Payable on delivery/.test(html));
  }

  if (name === "admin_test") {
    check("admin_test: claims no payment", /No payment collected/i.test(html));
    check("admin_test: no paid row", !/Amount paid online/.test(html));
  }
  if (name === "cod_fully_covered") {
    check("cod_fully_covered: falls back to prepaid", /Prepaid/.test(html), "a zero COD balance must not promise a collection");
  }

  // --- Plain text --------------------------------------------------------
  check(`${name}: text part non-empty`, text.trim().length > 200);
  check(`${name}: text has no html tags`, !/<[a-z/]/i.test(text));
  check(`${name}: text has no entities`, !/&(mdash|nbsp|bull|amp|lt|gt);/.test(text));
  check(`${name}: text has order number`, text.includes("#1014"));
  check(`${name}: text has cta url`, /https?:\/\/\S+/.test(text));
  check(`${name}: text has total`, text.includes("TOTAL: ₹"));

  // --- Gmail clipping ---------------------------------------------------
  const bytes = Buffer.byteLength(html, "utf8");
  check(`${name}: under Gmail 102KB clip`, bytes < GMAIL_CLIP_BYTES, `${(bytes / 1024).toFixed(1)}KB`);
  console.log(
    `${name.padEnd(24)} html ${(bytes / 1024).toFixed(1).padStart(5)}KB  text ${(Buffer.byteLength(text) / 1024).toFixed(1)}KB  "${subject}"`,
  );
}

// --- Escaping -------------------------------------------------------------
// A product title is free text and reaches this template straight from
// Firestore. Unescaped, one "<" in a title breaks the whole table structure
// and Outlook renders the rest of the email sideways.
const hostile = buildOrderConfirmationEmail({
  ...BASE,
  total: 100,
  paymentMode: "prepaid",
  items: [
    { title: '<script>alert(1)</script> & "quoted"', quantity: 1, price: 100 },
  ],
});
check("escaping: script tag neutralised", !/<script>/i.test(hostile.html), (hostile.html.match(/.{0,50}script.{0,50}/i) || [])[0]);
check("escaping: ampersand escaped", /&amp;/.test(hostile.html));
check("escaping: nesting still valid", walkNesting(markup(hostile.html)).error === null);
check(
  "escaping: no layout break",
  count(markup(hostile.html), "<td") === count(markup(hostile.html), "</td>"),
);

// --- Admin alert ---------------------------------------------------------
const admin = buildAdminOrderAlertEmail({
  ...BASE,
  total: 724,
  paymentMode: "cod_deposit",
  codDepositAmount: 100,
  paymentReceived: 100,
  codBalance: 624,
  codFee: 50,
});
check("admin: tables balanced", count(markup(admin.html), "<table") === count(markup(admin.html), "</table>"));
check("admin: no inline svg", !/<svg[\s>]/i.test(admin.html));
check("admin: shows collect amount", /Collect on delivery/.test(admin.html));
check("admin: cta opens admin", /\/admin\/orders/.test(admin.html));
check("admin: under Gmail clip", Buffer.byteLength(admin.html, "utf8") < GMAIL_CLIP_BYTES);
check("admin: subject names the order", /New order #1014/.test(admin.subject));

console.log(`\n${pass} checks passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`  FAIL  ${f}`);
  process.exit(1);
}

// A checker that never fails is worse than no checker, so prove it bites by
// re-running the structural checks against deliberately broken markup.
if (process.env.SELFTEST) {
  const broken = {
    "unclosed cell": "<table><tr><td>copy</tr></table>",
    "cell outside a row": "<table></tr><td>copy</td></tr></table>",
    "row outside a table": "<tr><td>copy</td></tr>",
    "crossed tags": "<table><tr><td>copy</table></tr>",
  };
  let caught = 0;
  for (const [label, bad] of Object.entries(broken)) {
    const n = walkNesting(markup(bad));
    const isBad = n.error !== null || n.cellWithoutRow || n.rowWithoutTable;
    console.log(`  selftest ${isBad ? "caught" : "MISSED"}  ${label}${isBad ? ` (${n.error})` : ""}`);
    if (isBad) caught += 1;
  }
  if (caught !== Object.keys(broken).length) {
    console.log(`\nselftest FAILED: caught ${caught}/${Object.keys(broken).length}`);
    process.exit(1);
  }
  console.log(`selftest ok: caught ${caught}/${Object.keys(broken).length}`);
}
