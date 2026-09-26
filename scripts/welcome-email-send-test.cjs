/**
 * Sends the real welcome email to a live inbox.
 *
 * Modelled on order-confirmation-send-test.cjs and held to the same rules: the
 * transport is NOT mocked, so the real template, the real sendWelcomeEmail and
 * the real Resend/Gmail provider all run. Only Firestore is stubbed, and the
 * stub's set() is a no-op, so a test run cannot write to the users collection.
 *
 * The artwork pipeline is deliberately NOT stubbed. This script exists to prove
 * the three hosted WebPs can be fetched, re-encoded to JPEG and attached as
 * inline MIME parts, and a stub would prove nothing about that.
 *
 * The idempotency key is `welcome-email-${uid}` and the provider drops repeats,
 * so this script uses a fresh uid per run — otherwise the second and every
 * later test send would be silently de-duplicated and this would report success
 * while delivering nothing.
 *
 * Usage:
 *   npm run welcome:email:send-test -- --to=you@example.com
 *   npm run welcome:email:send-test -- --to=you@example.com --name=Harshit
 *   npm run welcome:email:send-test -- --to=you@example.com --dry-run
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
const firstName = arg("name", "Harshit").trim();
const lastName = arg("lastname", "Pathak").trim();
const dryRun = has("dry-run");

if (!to && !dryRun) {
  console.error("No recipient. Pass --to=you@example.com or set TEST_EMAIL_TO.");
  process.exit(2);
}

// The real transport. "server-only" throws outside a Next.js server runtime, so
// it is the one thing stubbed here.
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

// Inert stub: get() always reports an empty doc and set() does nothing, so the
// de-duplication guard sees no prior send and a run cannot write to Firestore.
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

const emailChrome = loadTypeScript(
  path.join(process.cwd(), "src", "lib", "email-templates", "emailChrome.ts"),
);

const welcomeTemplate = loadTypeScriptWithMocks(
  path.join(process.cwd(), "src", "lib", "email-templates", "welcomeEmail.ts"),
  { "./emailChrome": emailChrome },
);

const welcomeAssets = loadTypeScriptWithMocks(
  path.join(process.cwd(), "src", "lib", "welcome-email-assets.ts"),
  {
    "server-only": {},
    "@/lib/email-templates/welcomeEmail": welcomeTemplate,
  },
);

const welcomeEmail = loadTypeScriptWithMocks(
  path.join(process.cwd(), "src", "lib", "welcome-email.ts"),
  {
    "server-only": {},
    "@/lib/firebase-admin": firebaseAdmin,
    "@/lib/email-sender": emailSender,
    "@/lib/email-templates/welcomeEmail": welcomeTemplate,
    "@/lib/welcome-email-assets": welcomeAssets,
  },
);

// A fresh uid per run, so the per-uid idempotency key cannot swallow the send.
const uid = `welcome-send-test-${Date.now()}`;


(async () => {
  console.log(
    `${dryRun ? "DRY RUN" : "sending"} via ${
      emailSender.configuredEmailProvider() || "none"
    } -> ${to || "(nobody)"}`,
  );
  console.log(`  ${firstName} ${lastName}`);

  if (dryRun) {
    // Still runs the real artwork pipeline, so it reports the true payload the
    // send would produce rather than a guess.
    const t0 = Date.now();
    const artwork = await welcomeAssets.buildWelcomeImages();
    for (const a of artwork.attachments) {
      console.log(
        `    cid:${a.cid}  ${(a.content.length / 1024).toFixed(1)}KB  ${a.contentType}`,
      );
    }
    if (artwork.skipped.length) {
      console.log(`  artwork skipped: ${artwork.skipped.join(", ")}`);
    }

    const email = welcomeTemplate.buildWelcomeEmail({
      firstName,
      lastName,
      email: to || "dry-run@example.com",
      images: artwork.images,
    });
    console.log(
      `  ${String((email.html.length / 1024).toFixed(1)).padStart(6)}KB html  ` +
        `${String(email.text.length)}B text  "${email.subject}"`,
    );
    console.log(`  preheader: ${email.preheader}`);
    console.log(
      `  artwork: ${artwork.attachments.length} embedded, ` +
        `${(artwork.bytes / 1024).toFixed(1)}KB total, ${Date.now() - t0}ms`,
    );
    return;
  }

  try {
    const result = await welcomeEmail.sendWelcomeEmail({
      uid,
      email: to,
      firstName,
      lastName,
    });
    if (result.sent) console.log(`  sent  uid:${uid}`);
    else if (result.skipped) {
      console.log(`  SKIPPED  ${result.reason || "(provider de-duplicated)"}`);
    } else {
      console.log(`  FAILED  ${result.reason || "(reason recorded on the user doc)"}`);
    }
    process.exitCode = result.sent ? 0 : 1;
  } catch (error) {
    console.error(`  ERROR  ${error.message}`);
    process.exitCode = 1;
  }
})();
