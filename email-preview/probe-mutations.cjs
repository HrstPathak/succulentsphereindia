/**
 * Mutation harness. Reverts each fix in turn and asserts the verifier goes red,
 * then restores the file.
 *
 * A regression check that cannot fail is worse than no check: it reads as
 * protection while proving nothing. Each mutation below is the kind of edit
 * someone would make while tidying up — dropping a min-width, dropping a
 * background, dropping the padding — and each must turn the suite red. The
 * items-band mutations in particular are the ones worth proving, because the
 * original bug was invisible to both the old checks and a desktop screenshot.
 *
 * Usage: node email-preview/probe-mutations.cjs
 */
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "src", "lib", "email-templates", "orderConfirmation.ts");
const original = fs.readFileSync(SRC, "utf8");

const MUTATIONS = [
  {
    name: "thumbnail chip loses its min-width",
    pattern: /class="ss-thumb-cell" style="width:64px;min-width:64px;/g,
    replace: 'class="ss-thumb-cell" style="width:64px;',
  },
  {
    name: "thumbnail loses object-fit",
    pattern: /object-fit:cover;object-position:center center/g,
    replace: "",
  },
  {
    // Matches the band panel's opening tag only: the other card tables use
    // BRAND.trustCream or a different padding, so this cannot hit them. The
    // quote before the ">" is part of the style attribute and must be matched.
    name: "items band drops its card background",
    pattern:
      /(margin:0 auto;)background:\$\{BRAND\.card\}(">[\s\S]{0,90}?<td class="ss-pad" style="padding:26px 34px 0">)/g,
    replace: "$1$2",
  },
  {
    name: "items band drops its horizontal padding",
    pattern: /<td class="ss-pad" style="padding:26px 34px 0">/g,
    replace: '<td style="padding:26px 0 0">',
  },
  {
    // Injects the wordmark text straight into rendered output rather than
    // re-adding the masthead() call. Re-adding the call would fail to compile
    // (the import is deliberately gone), so the suite would go red for the
    // wrong reason and the check would never actually be exercised.
    name: "wordmark text reappears in the message",
    pattern: />ORDER CONFIRMED</g,
    replace: ">SMALL PLANTS. BIG JOY.",
  },
];

function run() {
  try {
    const out = execFileSync("npm.cmd", ["run", "--silent", "order:confirmation:verify"], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    });
    return { ok: true, out };
  } catch (error) {
    return { ok: false, out: `${error.stdout || ""}${error.stderr || ""}` };
  }
}

// The verifier prints "<n> checks passed, <m> failed" and exits 1 when m > 0.
// Parse the count rather than trusting the exit code alone, so a build error
// is not mistaken for a caught mutation.
const failureCount = (out) => {
  const m = out.match(/(\d+)\s+checks passed,\s*(\d+)\s+failed/);
  return m ? Number(m[2]) : null;
};

const results = [];
try {
  for (const mutation of MUTATIONS) {
    // RegExp, not a literal needle: several of these markers occur more than
    // once (the band has an empty-items branch as well as the main one), and a
    // literal replace that only hits the first occurrence leaves the check
    // passing and reports a false "MISSED".
    const mutated = original.replace(mutation.pattern, mutation.replace);
    if (mutated === original) {
      results.push({ ...mutation, status: "SKIPPED", detail: "pattern matched nothing" });
      continue;
    }
    fs.writeFileSync(SRC, mutated, "utf8");
    const { ok, out } = run();
    const failed = failureCount(out);
    const caught = failed !== null ? failed > 0 : !ok;
    results.push({
      ...mutation,
      status: caught ? "caught" : "MISSED",
      // Check names contain spaces ("cod_deposit: items band is padded"), so
      // the leading run is any whitespace followed by anything at all.
      detail: (out.match(/^\s+.*>>>.*$/m) || ["(verifier reported no failing check)"])[0]
        .trim()
        .slice(0, 72),
    });
  }
} finally {
  fs.writeFileSync(SRC, original, "utf8");
  // The suite rebuilds render/orderConfirmation.js from the source on every
  // run, so after the last mutation that compiled output still holds MUTATED
  // code. Restoring the .ts alone leaves the preview build wrong, and anything
  // that requires it afterwards silently reads the mutation. Rebuild before
  // doing anything else.
  try {
    execFileSync("npm.cmd", ["run", "--silent", "order:email:build"], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    });
  } catch (error) {
    console.error("restore rebuild FAILED:", `${error.stdout || ""}${error.stderr || ""}`);
    process.exitCode = 1;
  }
}

console.log("mutation results (each must be 'caught'):\n");
let bad = 0;
for (const r of results) {
  if (r.status !== "caught") bad++;
  console.log(`  ${r.status === "caught" ? "OK      " : "PROBLEM "} ${r.name}`);
  if (r.detail) console.log(`           -> ${r.detail}`);
}
console.log(`\n${results.length - bad}/${results.length} mutations caught.`);
process.exitCode = bad ? 1 : 0;

/**
 * Self-test of the two checks the mutations above cannot isolate on their own.
 *
 * The "wordmark text reappears" mutation trips the nesting validator first, so
 * a green run there does not prove the wordmark check works. These run the
 * check expressions directly against the real rendered HTML with a single
 * deliberate edit, which is unambiguous.
 */
const { buildOrderConfirmationEmail, buildAdminOrderAlertEmail } = require("./render/orderConfirmation.js");
const base = require("./probe-input.json");

const wordmark = (h) => !/SMALL PLANTS\. BIG JOY\./.test(h) && !/logo-mark\.png/.test(h);
const bandPanel = (h) =>
  /<table[^>]*background:#FFFFFF[^>]*>\s*<tr>\s*<td class="ss-pad" style="padding:26px 34px 0">/i.test(h);

const clean = buildOrderConfirmationEmail(base).html;
const adminClean = buildAdminOrderAlertEmail(base).html;

const cases = [
  ["wordmark check passes on clean customer html", wordmark(clean), true],
  ["wordmark check fails on rewordmarked html", wordmark(clean.replace("ORDER CONFIRMED", "SMALL PLANTS. BIG JOY.")), false],
  ["wordmark check fails on a logo-mark reference", wordmark(clean.replace("</body>", '<img src="https://x/images/email/logo-mark.png"></body>')), false],
  ["wordmark check passes on clean admin html", wordmark(adminClean), true],
  ["band check passes on clean html", bandPanel(clean), true],
  [
    "band check fails when the background is dropped",
    bandPanel(
      clean.replace(
        'max-width:620px;margin:0 auto;background:#FFFFFF">\n        <tr>\n          <td class="ss-pad" style="padding:26px 34px 0">',
        'max-width:620px;margin:0 auto">\n        <tr>\n          <td class="ss-pad" style="padding:26px 34px 0">',
      ),
    ),
    false,
  ],
];

let selftestBad = 0;
console.log("check self-test:\n");
for (const [label, actual, expected] of cases) {
  const ok = actual === expected;
  if (!ok) selftestBad++;
  console.log(`  ${ok ? "OK      " : "PROBLEM "} ${label} (got ${actual}, want ${expected})`);
}
if (selftestBad) {
  process.exitCode = 1;
  console.log(`\n${selftestBad} self-test case(s) wrong.`);
} else {
  console.log(`\n${cases.length}/${cases.length} check self-tests ok.`);
}
