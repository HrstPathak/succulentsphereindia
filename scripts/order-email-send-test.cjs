/**
 * Sends the real order status emails to a live inbox.
 *
 * Unlike order-email-smoke.cjs this does not mock the transport: the real
 * template, the real sendOrderStatusEmail and the real Resend/Gmail provider
 * all run. Only Firestore is stubbed, and the stub returns an empty order doc
 * so the de-duplication guard does not suppress the test sends. That means this
 * also exercises the guard in the "nothing sent yet" direction.
 *
 * Usage:
 *   npm run order:email:send-test -- --to=you@example.com
 *   npm run order:email:send-test -- --to=you@example.com --only=OUT_FOR_DELIVERY
 *   npm run order:email:send-test -- --to=you@example.com --dry-run
 *
 * Honours TEST_EMAIL_TO as the default recipient.
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
const only = arg("only", "").trim().toUpperCase();
const dryRun = has("dry-run");

const ORDER_STATUSES = ["IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"];
const statuses = only ? ORDER_STATUSES.filter((s) => s === only) : ORDER_STATUSES;
if (!statuses.length) {
  console.error(`--only must be one of: ${ORDER_STATUSES.join(", ")}`);
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

// Empty order doc => the de-dup guard sees no prior send and lets the email
// through, so each status actually reaches the inbox.
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

const orderEmail = loadTypeScriptWithMocks(
  path.join(process.cwd(), "src", "lib", "order-email.ts"),
  {
    "server-only": {},
    "@/lib/firebase-admin": firebaseAdmin,
    "@/lib/email-sender": emailSender,
    "@/lib/delhiveryTracking": {
      buildDelhiveryTrackingUrl: (n) => `https://www.delhivery.com/track/package/${n}`,
    },
    "@/lib/email-templates/orderStatus": loadTypeScript(
      path.join(process.cwd(), "src", "lib", "email-templates", "orderStatus.ts"),
    ),
  },
);

const orderNumber = arg("order", "1009");
const trackingNumber = arg("tracking", "1234567890123");

(async () => {
  console.log(
    `${dryRun ? "DRY RUN" : "sending"} via ${emailSender.configuredEmailProvider() || "none"} -> ${to || "(nobody)"}`,
  );
  if (only) console.log(`status filter: ${only}`);

  let failed = 0;
  for (const status of statuses) {
    const input = {
      orderId: "email-send-test",
      orderNumber: Number(orderNumber),
      customerName: "Harshit Pathak",
      customerEmail: to || "dry-run@example.com",
      status,
      trackingNumber,
      carrier: "Delhivery",
      // Only OUT_FOR_DELIVERY renders the cash-on-delivery notice.
      amountDue: status === "OUT_FOR_DELIVERY" ? 249 : 0,
    };

    if (dryRun) {
      const { buildOrderStatusEmail } = loadTypeScript(
        path.join(process.cwd(), "src", "lib", "email-templates", "orderStatus.ts"),
      );
      const email = buildOrderStatusEmail(input);
      console.log(
        `  ${status.padEnd(17)} ${String(email.html.length / 1024).padStart(6)}KB html  ` +
          `${String(email.text.length)}B text  "${email.subject}"`,
      );
      continue;
    }

    try {
      const result = await orderEmail.sendOrderStatusEmail(input);
      if (result.sent) console.log(`  sent    ${status}  ${result.id || ""}`);
      else if (result.skipped) console.log(`  SKIPPED ${status}  ${result.reason || "(de-duplicated)"}`);
      // sendOrderStatusEmail returns {sent:false} without the reason; the
      // error is written to the order doc instead, so point at that.
      else console.log(`  FAILED  ${status}  (reason recorded on the order doc)`);
      if (!result.sent) failed += 1;
    } catch (error) {
      console.error(`  ERROR   ${status}  ${error.message}`);
      failed += 1;
    }
    // A short gap keeps Gmail from treating a burst of four as spam.
    if (!dryRun && status !== statuses.at(-1)) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  if (dryRun) return;
  console.log(failed ? `\n${failed} of ${statuses.length} did not send` : `\nall ${statuses.length} sent`);
  process.exitCode = failed ? 1 : 0;
})();
