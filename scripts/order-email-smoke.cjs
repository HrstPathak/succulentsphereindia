const assert = require("node:assert/strict");
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

/**
 * Order status / tracking email smoke test.
 *
 * The de-duplication is the risky part: two different admin entry points can
 * produce the SAME "your plants are on the way" email, and the customer only
 * ever wants to read it once. These cases pin both directions of that guard.
 */

const sent = [];
const writes = [];
let orderDoc = {};

const emailSender = {
  configuredEmailProvider: () => "resend",
  sendEmail: async (input) => {
    sent.push(input);
    return { provider: "resend", id: `mock-${sent.length}` };
  },
};

const firebaseAdmin = {
  getFirebaseDb: () => ({
    collection: () => ({
      doc: () => ({
        get: async () => ({ data: () => orderDoc }),
        set: async (data) => {
          writes.push(data);
        },
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
      buildDelhiveryTrackingUrl: (n) => `https://track.delhivery.com/track/package/${n}`,
    },
    "@/lib/email-templates/orderStatus": loadTypeScript(
      path.join(process.cwd(), "src", "lib", "email-templates", "orderStatus.ts"),
    ),
  },
);

const customer = { customerName: "Harshit Pathak", customerEmail: "harshit@example.com" };
const AWB = "1234567890123";

function reset(doc) {
  orderDoc = doc;
  sent.length = 0;
  writes.length = 0;
}

async function testTrackingSkipsWhenStatusEmailSent() {
  reset({ statusEmail_IN_TRANSIT: { status: "sent", sentAt: "2026-01-01T00:00:00.000Z" } });
  const result = await orderEmail.sendTrackingEmail({
    orderId: "o1", orderNumber: 1009, ...customer, trackingNumber: AWB,
  });
  assert.equal(result.sent, false, "tracking email must not send");
  assert.equal(result.skipped, true, "tracking email must report as skipped");
  assert.equal(sent.length, 0, "no email should reach the provider");
  assert.equal(
    writes.at(-1).trackingEmailSkipReason,
    "in_transit_status_email_already_sent",
    "the skip reason must be recorded for support",
  );
}

async function testStatusSkipsWhenTrackingEmailSent() {
  reset({ trackingEmailStatus: "sent", trackingEmailSentAt: "2026-01-01T00:00:00.000Z" });
  const result = await orderEmail.sendOrderStatusEmail({
    orderId: "o1", orderNumber: 1009, ...customer, status: "IN_TRANSIT", trackingNumber: AWB,
  });
  assert.equal(result.sent, false, "duplicate IN_TRANSIT must not send");
  assert.equal(result.skipped, true, "duplicate IN_TRANSIT must report as skipped");
  assert.equal(sent.length, 0, "no email should reach the provider");
  assert.equal(
    writes.at(-1).statusEmail_IN_TRANSIT.reason,
    "tracking_email_already_sent",
    "the skip reason must be recorded for support",
  );
}

async function testLaterStatusesStillSendAfterTrackingEmail() {
  reset({ trackingEmailStatus: "sent" });
  for (const status of ["OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"]) {
    sent.length = 0;
    const result = await orderEmail.sendOrderStatusEmail({
      orderId: "o1", orderNumber: 1009, ...customer, status, trackingNumber: AWB,
    });
    assert.equal(result.sent, true, `${status} is a genuinely new state and must send`);
    assert.equal(sent.length, 1, `${status} should send exactly one email`);
    assert.equal(writes.at(-1)[`statusEmail_${status}`].status, "sent", `${status} must be recorded`);
  }
}

async function testFirstSendStillDelivers() {
  reset({});
  const result = await orderEmail.sendOrderStatusEmail({
    orderId: "o1", orderNumber: 1009, ...customer, status: "IN_TRANSIT", trackingNumber: AWB,
  });
  assert.equal(result.sent, true, "the first IN_TRANSIT must deliver");
  assert.equal(sent.length, 1);
  assert.match(sent[0].subject, /#1009/);
  assert.ok(sent[0].text && sent[0].text.length > 200, "a plain-text part must be sent");
  assert.ok(sent[0].html.includes(AWB), "the tracking number must reach the email");
  assert.equal(writes.at(-1).statusEmail_IN_TRANSIT.provider, "resend", "the provider must be recorded");
}

async function testTrackingStillSendsWhenNoPriorEmail() {
  reset({});
  const result = await orderEmail.sendTrackingEmail({
    orderId: "o1", orderNumber: 1009, ...customer, trackingNumber: AWB,
  });
  assert.equal(result.sent, true, "the dispatch email must deliver when nothing has been sent");
  assert.equal(sent.length, 1);
  assert.equal(writes.at(-1).trackingEmailStatus, "sent");
}

async function testFailedPriorSendDoesNotBlock() {
  // A previous failure must not permanently suppress the email.
  reset({ trackingEmailStatus: "failed", statusEmail_IN_TRANSIT: { status: "failed" } });
  const tracking = await orderEmail.sendTrackingEmail({
    orderId: "o1", orderNumber: 1009, ...customer, trackingNumber: AWB,
  });
  assert.equal(tracking.sent, true, "a failed tracking attempt must not block a retry");

  sent.length = 0;
  const status = await orderEmail.sendOrderStatusEmail({
    orderId: "o1", orderNumber: 1009, ...customer, status: "IN_TRANSIT", trackingNumber: AWB,
  });
  assert.equal(status.sent, true, "a failed status attempt must not block a retry");
}

async function testNoProviderConfiguredSkips() {
  reset({});
  const original = emailSender.configuredEmailProvider;
  emailSender.configuredEmailProvider = () => "";
  try {
    const result = await orderEmail.sendOrderStatusEmail({
      orderId: "o1", orderNumber: 1009, ...customer, status: "IN_TRANSIT",
    });
    assert.equal(result.skipped, true);
    assert.equal(sent.length, 0);
  } finally {
    emailSender.configuredEmailProvider = original;
  }
}

const tests = [
  ["tracking skips when the IN_TRANSIT status email already sent", testTrackingSkipsWhenStatusEmailSent],
  ["IN_TRANSIT skips when the tracking email already sent", testStatusSkipsWhenTrackingEmailSent],
  ["OUT_FOR_DELIVERY / DELIVERED / CANCELLED still send", testLaterStatusesStillSendAfterTrackingEmail],
  ["first IN_TRANSIT still delivers html + text", testFirstSendStillDelivers],
  ["tracking email still sends when nothing has been sent", testTrackingStillSendsWhenNoPriorEmail],
  ["a previously failed send does not block a retry", testFailedPriorSendDoesNotBlock],
  ["missing provider config skips without throwing", testNoProviderConfiguredSkips],
];

(async () => {
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log(`  ok  ${name}`);
    } catch (error) {
      console.error(`  FAIL  ${name}`);
      console.error(`        ${error.message}`);
      process.exitCode = 1;
    }
  }
  if (process.exitCode) console.error("\nOrder email smoke test FAILED");
  else console.log(`\nOrder email smoke test passed (${tests.length} cases)`);
})();

