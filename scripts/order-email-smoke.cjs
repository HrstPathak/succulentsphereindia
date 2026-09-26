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

/**
 * Stands in for the real thumbnail pipeline.
 *
 * It reproduces the one behaviour the confirmation email depends on — rewriting
 * a remote image URL into a `cid:` reference and attaching bytes under that cid
 * — without touching the network or sharp. The bytes are a stub; the contract
 * (item.image becomes cid:N, attachment N carries that cid) is what matters.
 */
const emailThumbnail = {
  buildProductThumbnails: async (items) => {
    const attachments = [];
    const byUrl = new Map();
    const out = items.map((item) => {
      const url = String((item && item.image) || "").trim();
      if (!/^https?:\/\//i.test(url)) return { ...item, image: "" };
      if (byUrl.has(url)) return { ...item, image: byUrl.get(url) };
      const cid = `product-${attachments.length}`;
      attachments.push({
        cid,
        content: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
        contentType: "image/jpeg",
        filename: `${cid}.jpg`,
      });
      byUrl.set(url, `cid:${cid}`);
      return { ...item, image: `cid:${cid}` };
    });
    return { items: out, attachments, skipped: 0 };
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

/**
 * Loads a module from src/lib/email-templates with its sibling chrome module
 * stubbed in.
 *
 * The templates import the shared chrome with a relative "./emailChrome"
 * specifier (see the note in emailChrome.ts — a path alias would be emitted
 * verbatim by tsc and then fail to resolve on plain node). Node cannot require
 * a .ts file, so the chrome is transpiled once here and handed to the template
 * through the same Module._load interception the aliases use.
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
    "@/lib/email-thumbnail": emailThumbnail,
    "@/lib/delhiveryTracking": {
      buildDelhiveryTrackingUrl: (n) => `https://track.delhivery.com/track/package/${n}`,
    },
    "@/lib/email-templates/orderStatus": loadTemplate("orderStatus.ts"),
    "@/lib/email-templates/orderConfirmation": loadTemplate("orderConfirmation.ts"),
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

/**
 * The partial-COD confirmation, end to end through the real send path.
 *
 * This is the one case where being wrong is expensive rather than ugly: the
 * customer reads the amount due, keeps that much cash ready, and hands it to
 * the delivery agent. So the assertions are on the actual numbers in the
 * message that went out, not on the template in isolation.
 */
async function testCodConfirmationStatesTheSplit() {
  reset({});
  const result = await orderEmail.sendOrderConfirmationEmail({
    orderId: "o1",
    orderNumber: 1014,
    customerName: "Rose maria",
    customerEmail: "rose@example.com",
    items: [
      {
        title: "Moonstone",
        quantity: 3,
        price: 224.67,
        image: "https://cdn.example.com/products/moonstone.jpg",
      },
    ],
    total: 724,
    paymentMode: "cod_deposit",
    codDepositAmount: 100,
    paymentReceived: 100,
    codBalance: 624,
    codFee: 50,
    address: "Vellookunnel house",
    city: "Kerala",
    pincode: "685604",
  });
  assert.equal(result.sent, true, "the COD confirmation must deliver");
  assert.equal(sent.length, 1);

  const message = sent[0];
  assert.match(message.subject, /#1014/, "the subject must name the order");
  assert.ok(message.text && message.text.length > 200, "a plain-text part must be sent");

  // The advance and the balance, in the HTML the customer actually receives.
  assert.ok(message.html.includes("PAID NOW"), "the paid-now figure must be shown");
  assert.ok(message.html.includes("DUE ON DELIVERY"), "the due-on-delivery figure must be shown");
  assert.ok(message.html.includes("₹100.00"), "the Rs 100 advance must be printed");
  assert.ok(message.html.includes("₹624.00"), "the Rs 624 balance must be printed");
  assert.ok(
    !message.html.includes("₹724.00 due"),
    "the total must never be presented as the amount due",
  );

  // ...and in the text fallback, for the clients that only get that.
  assert.match(message.text, /Paid now:\s*₹100\.00/);
  assert.match(message.text, /Due on delivery:\s*₹624\.00/);

  // The plant photo has to survive the whole journey as an inline MIME part.
  // A cid: reference with no matching attachment is worse than no image at
  // all: the reader sees a broken-image box they cannot click through.
  assert.equal(
    (message.inlineImages || []).length,
    1,
    "the product photo must be attached inline",
  );
  assert.equal(message.inlineImages[0].cid, "product-0");
  assert.equal(message.inlineImages[0].contentType, "image/jpeg");
  assert.ok(
    message.inlineImages[0].content.length > 0,
    "the inline image must carry bytes",
  );
  assert.ok(
    message.html.includes('src="cid:product-0"'),
    "the item row must reference the attached image by cid",
  );
  assert.ok(
    !/src="https?:\/\/[^"]*moonstone\.jpg"/.test(message.html),
    "the remote URL must be replaced, not merely supplemented",
  );

  // The admin copy tells the packer the same figure the agent will collect.
  // ADMIN_EMAILS drives that send, so it is set for the duration of this case
  // rather than depending on whatever the developer happens to have locally.
  const previousAdmins = process.env.ADMIN_EMAILS;
  process.env.ADMIN_EMAILS = "ops@example.com";
  sent.length = 0;
  try {
    await orderEmail.sendOrderConfirmationEmail({
      orderId: "o3",
      orderNumber: 1016,
      customerName: "Rose maria",
      customerEmail: "rose@example.com",
      items: [{ title: "Moonstone", quantity: 1, price: 674 }],
      total: 724,
      paymentMode: "cod_deposit",
      codDepositAmount: 100,
      paymentReceived: 100,
      codBalance: 624,
      codFee: 50,
    });
  } finally {
    if (previousAdmins === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = previousAdmins;
  }
  const admin = sent.find((m) => m.idempotencyKey.startsWith("order-admin-notify"));
  assert.ok(admin, "the admin alert must be sent");
  assert.ok(admin.html.includes("₹624.00"), "the admin must see the collectable amount");
  assert.ok(admin.html.includes("Collect on delivery"), "the admin must be told to collect it");
}

/** A fully-paid order must not promise a collection that will never happen. */
async function testPrepaidConfirmationMakesNoCollectionClaim() {
  reset({});
  const result = await orderEmail.sendOrderConfirmationEmail({
    orderId: "o2",
    orderNumber: 1015,
    customerName: "Rose maria",
    customerEmail: "rose@example.com",
    items: [{ title: "Moonstone", quantity: 3, price: 218 }],
    total: 654,
    paymentMode: "prepaid",
    paymentReceived: 654,
    address: "Vellookunnel house",
    city: "Kerala",
    pincode: "685604",
  });
  assert.equal(result.sent, true);
  const message = sent[0];
  assert.ok(message.html.includes("Prepaid"), "a paid order must read as prepaid");
  assert.ok(
    !message.html.includes("DUE ON DELIVERY"),
    "a prepaid order must not carry a due-on-delivery block",
  );
  assert.ok(!message.html.includes("Payable on delivery"), "nor a payable-on-delivery row");
}

const tests = [
  ["tracking skips when the IN_TRANSIT status email already sent", testTrackingSkipsWhenStatusEmailSent],
  ["IN_TRANSIT skips when the tracking email already sent", testStatusSkipsWhenTrackingEmailSent],
  ["OUT_FOR_DELIVERY / DELIVERED / CANCELLED still send", testLaterStatusesStillSendAfterTrackingEmail],
  ["first IN_TRANSIT still delivers html + text", testFirstSendStillDelivers],
  ["tracking email still sends when nothing has been sent", testTrackingStillSendsWhenNoPriorEmail],
  ["a previously failed send does not block a retry", testFailedPriorSendDoesNotBlock],
  ["missing provider config skips without throwing", testNoProviderConfiguredSkips],
  ["COD confirmation states the paid / due split", testCodConfirmationStatesTheSplit],
  ["prepaid confirmation makes no collection claim", testPrepaidConfirmationMakesNoCollectionClaim],
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

