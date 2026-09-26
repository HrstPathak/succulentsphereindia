/**
 * Sends the real order confirmation email to a live inbox.
 *
 * The counterpart to order-email-send-test.cjs, which only covers the four
 * lifecycle emails. Same rule: the transport is NOT mocked, so the real
 * template, the real sendOrderConfirmationEmail and the real Resend/Gmail
 * provider all run. Only Firestore is stubbed, and the stub's set() is a no-op,
 * so a test run cannot write to the orders collection.
 *
 * The admin "new order" alert is suppressed unless --admin is passed, because
 * ADMIN_EMAILS points at the real inbox and a test run should not page it.
 *
 * Usage:
 *   npm run order:confirmation:send-test -- --to=you@example.com
 *   npm run order:confirmation:send-test -- --to=you@example.com --fixture=prepaid
 *   npm run order:confirmation:send-test -- --to=you@example.com --admin
 *   npm run order:confirmation:send-test -- --to=you@example.com --dry-run
 *
 * Honours TEST_EMAIL_TO as the default recipient, falling back to GMAIL_USER.
 */

const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const ts = require("typescript");

function loadTypeScript(file) {
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
  loaded._compile(output, file);
  return loaded.exports;
}

function loadTypeScriptWithMocks(file, mocks) {
  const originalLoad = Module._load;
  Module._load = function mockedLoad(request, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(mocks, request)) return mocks[request];
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    return loadTypeScript(file);
  } finally {
    Module._load = originalLoad;
  }
}

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const has = (name) => process.argv.includes(`--${name}`);

const to = arg("to", process.env.TEST_EMAIL_TO || process.env.GMAIL_USER || "").trim();
const dryRun = has("dry-run");
const sendAdmin = has("admin");
const fixtureName = arg("fixture", "cod_deposit").trim();

/**
 * Real catalogue image URLs, so the send-test exercises the thumbnail pipeline
 * against the same ~800 KB PNGs production hits rather than a stub. Two rows
 * deliberately share nothing, and the prepaid fixture reuses pinkMoonstone, so
 * the dedupe-by-URL path gets a live run too.
 */
const IMG = {
  pinkMoonstone:
    "https://whitesmoke-cattle-754161.hostingersite.com/products/pink-moonstone-pachyphytum-oviferum-pearl-pink-egg-leaf-succulent/1-Gemini_Generated_Image_5act835act835act.png",
  whiteMoonstone:
    "https://whitesmoke-cattle-754161.hostingersite.com/products/moonstone-pachyphytum-oviferum-pearl-white-egg-leaf-succulent/1-moonsone_succulent.jpg",
  bunnyEar:
    "https://whitesmoke-cattle-754161.hostingersite.com/products/bunny-ear-yellow-cactus-opuntia-red-polka-dot-decorative-cactus/1-Yello_Bunny_Cactus_in_white_pot.png",
};

/**
 * Realistic fixtures, one per payment shape the template can render.
 *
 * The COD figures are the ones from the live order this was built against:
 * ₹724 total made up of ₹674 of plants plus a ₹50 COD fee, with the ₹100
 * advance already collected. Paid and due sum to 724, not 674, because the
 * deposit is taken against the order total including the fee — which is the
 * behaviour the real wallet flow depends on, so the fixture has to keep it.
 */
const FIXTURES = {
  cod_deposit: {
    label: "COD with ₹100 advance (the case this email exists for)",
    build: (recipient) => ({
      orderNumber: 1014,
      customerName: "Rose Maria",
      customerEmail: recipient,
      phone: "9778398376",
      address: "Vellookunnu house, thazepathinaramkandom",
      city: "Kerala",
      state: "Kerala",
      pincode: "685604",
      items: [
        { title: "Pink Moonstone (Pachyphytum oviferum) - Pearl Pink Egg Leaf", quantity: 3, price: 139, image: IMG.pinkMoonstone },
        { title: "Moonstone (Pachyphytum oviferum) - Pearl White Egg Leaf", quantity: 3, price: 79, image: IMG.whiteMoonstone },
      ],
      total: 724,
      paymentMode: "cod_deposit",
      codDepositAmount: 100,
      codBalance: 624,
      codFee: 50,
    }),
  },
  prepaid: {
    label: "Prepaid, paid in full",
    build: (recipient) => ({
      orderNumber: 1015,
      customerName: "Rose Maria",
      customerEmail: recipient,
      phone: "9778398376",
      address: "Vellookunnu house, thazepathinaramkandom",
      city: "Kerala",
      state: "Kerala",
      pincode: "685604",
      items: [
        { title: "Pink Moonstone (Pachyphytum oviferum) - Pearl Pink Egg Leaf", quantity: 3, price: 139, image: IMG.pinkMoonstone },
      ],
      total: 466,
      paymentMode: "prepaid",
      shipping: 49,
    }),
  },
  cod: {
    label: "COD, nothing paid up front — the whole amount is due",
    build: (recipient) => ({
      orderNumber: 1016,
      customerName: "Rose Maria",
      customerEmail: recipient,
      phone: "9778398376",
      address: "Vellookunnu house, thazepathinaramkandom",
      city: "Kerala",
      state: "Kerala",
      pincode: "685604",
      items: [
        { title: "Moonstone (Pachyphytum oviferum) - Pearl White Egg Leaf", quantity: 3, price: 79, image: IMG.whiteMoonstone },
      ],
      total: 287,
      paymentMode: "cod",
      codFee: 50,
    }),
  },
  cod_fully_covered: {
    label: "COD with the balance fully covered by wallet — must read as Prepaid",
    build: (recipient) => ({
      orderNumber: 1017,
      customerName: "Rose Maria",
      customerEmail: recipient,
      phone: "9778398376",
      address: "Vellookunnu house, thazepathinaramkandom",
      city: "Kerala",
      state: "Kerala",
      pincode: "685604",
      items: [
        { title: "Moonstone (Pachyphytum oviferum) - Pearl White Egg Leaf", quantity: 3, price: 79, image: IMG.whiteMoonstone },
      ],
      total: 287,
      paymentMode: "cod_deposit",
      codBalance: 0,
      walletAmountUsed: 237,
    }),
  },
};

const fixture = FIXTURES[fixtureName];
if (!fixture) {
  console.error(`--fixture must be one of: ${Object.keys(FIXTURES).join(", ")}`);
  process.exit(2);
}

if (!to && !dryRun) {
  console.error("No recipient. Pass --to=you@example.com or set TEST_EMAIL_TO.");
  process.exit(2);
}

// The real transport. "server-only" throws outside a Next.js server runtime,
// so it is the one thing stubbed here.
const emailSender = loadTypeScriptWithMocks(
  path.join(process.cwd(), "src", "lib", "email-sender.ts"),
  { "server-only": {} },
);

if (!emailSender.configuredEmailProvider() && !dryRun) {
  console.error(
    "No email provider configured. Set RESEND_API_KEY + ORDER_EMAIL_FROM, or GMAIL_USER + GMAIL_APP_PASSWORD in .env.local.",
  );
  process.exit(2);
}

// Every Firestore write is a no-op. A test send must not create or mutate an
// order document, and a fresh orderId below means it would only ever write to
// its own throwaway doc anyway.
const firebaseAdmin = {
  getFirebaseDb: () => ({
    collection: () => ({
      doc: () => ({
        get: async () => ({ data: () => ({}) }),
        set: async () => {},
      }),
    }),
  }),
};

/**
 * The templates import the shared chrome with a relative "./emailChrome"
 * specifier (see the note in emailChrome.ts — a path alias would be emitted
 * verbatim by tsc and then fail to resolve on plain node). Node cannot require
 * a .ts file, so the chrome is transpiled once here and handed to the
 * templates through the same Module._load interception the aliases use.
 */
const emailChrome = loadTypeScript(
  path.join(process.cwd(), "src", "lib", "email-templates", "emailChrome.ts"),
);

function loadTemplate(file) {
  return loadTypeScriptWithMocks(
    path.join(process.cwd(), "src", "lib", "email-templates", file),
    { "./emailChrome": emailChrome },
  );
}

const orderEmail = loadTypeScriptWithMocks(
  path.join(process.cwd(), "src", "lib", "order-email.ts"),
  {
    "server-only": {},
    "@/lib/firebase-admin": firebaseAdmin,
    "@/lib/email-sender": emailSender,
    // The real thumbnail pipeline, not a stub: this script exists to exercise
    // the actual fetch, resize and cid-rewrite against live catalogue images.
    "@/lib/email-thumbnail": loadTypeScriptWithMocks(
      path.join(process.cwd(), "src", "lib", "email-thumbnail.ts"),
      { "server-only": {} },
    ),
    "@/lib/delhiveryTracking": {
      buildDelhiveryTrackingUrl: (n) => `https://www.delhivery.com/track/package/${n}`,
    },
    "@/lib/email-templates/orderStatus": loadTemplate("orderStatus.ts"),
    "@/lib/email-templates/orderConfirmation": loadTemplate("orderConfirmation.ts"),
  },
);

const order = fixture.build(to || "dry-run@example.com");

// A unique order id per run. The idempotency key is
// `order-confirmation-${orderId}`, so reusing a fixed id would let the
// provider's de-duplication swallow the second and every later test send, and
// the script would report success while delivering nothing. A per-run id
// cannot collide with a real order, so nothing is suppressed in practice and
// nothing is written back, because the Firestore stub above is inert.
order.orderId = `confirmation-send-test-${Date.now()}`;

(async () => {
  console.log(
    `${dryRun ? "DRY RUN" : "sending"} fixture "${fixtureName}" via ${
      emailSender.configuredEmailProvider() || "none"
    } -> ${to || "(nobody)"}`,
  );
  console.log(`  ${fixture.label}`);

  if (dryRun) {
    const { buildOrderConfirmationEmail } = loadTemplate("orderConfirmation.ts");
    const email = buildOrderConfirmationEmail(order);
    console.log(
      `  ${String(email.html.length / 1024).padStart(6)}KB html  ` +
        `${String(email.text.length)}B text  "${email.subject}"`,
    );
    console.log(`  preheader: ${email.preheader}`);
    return;
  }

  if (!sendAdmin) {
    process.env.ADMIN_EMAILS = "";
    console.log("  admin alert suppressed (pass --admin to include it)");
  }

  try {
    const result = await orderEmail.sendOrderConfirmationEmail(order);
    if (result.sent) console.log(`  sent  ${result.id || ""}`);
    else if (result.skipped) console.log(`  SKIPPED  ${result.reason || "(provider de-duplicated)"}`);
    else console.log("  FAILED  (reason recorded on the order doc)");
    process.exitCode = result.sent ? 0 : 1;
  } catch (error) {
    console.error(`  ERROR  ${error.message}`);
    process.exitCode = 1;
  }
})();
