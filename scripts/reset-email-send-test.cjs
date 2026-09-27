/**
 * Sends the real password-reset email to a live inbox.
 *
 * Modelled on welcome-email-send-test.cjs and held to the same rules: the
 * transport is NOT mocked, so the real template, the real sendPasswordResetEmail
 * and the real Gmail provider all run. Only "server-only" is stubbed.
 *
 * Firebase is deliberately NOT stubbed either, and that is the point of this
 * script. A reset link is a one-shot credential — unlike the other send-tests,
 * an email built from a fabricated oobCode would arrive looking perfect and
 * then fail the moment it is clicked, which teaches nobody anything. This
 * mints a genuine link against the real project, so the address in the inbox
 * actually works and the whole round trip can be walked: email, click, land on
 * /reset-password, submit a new password.
 *
 * The consequence is that the recipient must already have a Firebase account.
 * For an address that does not, the script reports `user_not_found` and sends
 * nothing — which is the same answer production gives.
 *
 * Usage:
 *   npm run reset:email:send-test -- --to=you@example.com
 *   npm run reset:email:send-test -- --to=you@example.com --name=Harshit
 *   npm run reset:email:send-test -- --to=you@example.com --dry-run
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
const displayName = arg("name", "Harshit").trim();
const dryRun = has("dry-run");
const siteUrl = arg("site", process.env.NEXT_PUBLIC_SITE_URL || "https://succulentsphere.com")
  .trim()
  .replace(/\/+$/, "");

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

const emailChrome = loadTypeScript(
  path.join(process.cwd(), "src", "lib", "email-templates", "emailChrome.ts"),
);

const resetTemplate = loadTypeScriptWithMocks(
  path.join(process.cwd(), "src", "lib", "email-templates", "resetPassword.ts"),
  { "./emailChrome": emailChrome },
);

// The real Firebase admin, so the oobCode below is a genuine one.
const firebaseAdmin = loadTypeScriptWithMocks(
  path.join(process.cwd(), "src", "lib", "firebase-admin.ts"),
  { "server-only": {} },
);

const sendReset = loadTypeScriptWithMocks(
  path.join(process.cwd(), "src", "lib", "send-reset-email.ts"),
  {
    "server-only": {},
    "@/lib/firebase-admin": firebaseAdmin,
    "@/lib/email-sender": emailSender,
    "@/lib/email-templates/resetPassword": resetTemplate,
  },
);


(async () => {
  console.log(
    `${dryRun ? "DRY RUN" : "sending"} via ${
      emailSender.configuredEmailProvider() || "none"
    } -> ${to || "(nobody)"}`,
  );
  console.log(`  action url ${siteUrl}/reset-password`);

  // A real link, minted once, so the dry run reports the true payload and the
  // live run has something valid to send.
  let oobCode = "";
  try {
    const link = await firebaseAdmin
      .getFirebaseAdminAuth()
      .generatePasswordResetLink(to, { url: `${siteUrl}/reset-password` });
    oobCode = new URL(link).searchParams.get("oobCode") || "";
  } catch (error) {
    console.error(
      `  ERROR  could not mint a link: ${String((error && error.message) || error)}`,
    );
    if (!dryRun) {
      console.error(
        "         That address has no Firebase account, or the action URL is not on an authorised domain.",
      );
    }
    process.exitCode = 1;
    return;
  }
  if (!oobCode) {
    console.error("  ERROR  generated link carried no oobCode");
    process.exitCode = 1;
    return;
  }

  if (dryRun) {
    const email = resetTemplate.buildResetPasswordEmail({
      email: to || "dry-run@example.com",
      oobCode,
      displayName,
      siteUrl,
    });
    console.log(
      `  ${String((email.html.length / 1024).toFixed(1)).padStart(6)}KB html  ` +
        `${String(email.text.length)}B text  "${email.subject}"`,
    );
    console.log(`  preheader: ${email.preheader}`);
    console.log(`  resetUrl:  ${email.resetUrl.slice(0, 72)}...`);
    return;
  }

  const result = await sendReset.sendPasswordResetEmail({
    email: to,
    displayName,
    siteUrl,
  });
  if (result.sent) console.log("  sent");
  else if (result.skipped) console.log(`  SKIPPED  ${result.reason || "(skipped)"}`);
  else console.log(`  FAILED  ${result.reason || "(reason logged)"}`);
  process.exitCode = result.sent ? 0 : 1;
})();
