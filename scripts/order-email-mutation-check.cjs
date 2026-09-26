/**
 * Proves the de-duplication test actually bites: neutering the guard in
 * sendOrderStatusEmail must make the smoke test fail. Run manually when
 * touching the guard, to confirm the test is still meaningful.
 *
 *   node scripts/order-email-mutation-check.cjs
 */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const target = path.join(process.cwd(), "src", "lib", "order-email.ts");
const original = fs.readFileSync(target, "utf8");
const guard = 'if (String(tracking || "") === "sent") {';
const neutered = 'if (false) {';

if (!original.includes(guard)) {
  console.error(`Could not find the guard to neuter. Expected exactly:\n  ${guard}`);
  process.exit(2);
}

try {
  fs.writeFileSync(target, original.replace(guard, neutered));
  const run = spawnSync("node", [path.join(process.cwd(), "scripts", "order-email-smoke.cjs")], {
    encoding: "utf8",
  });
  const output = `${run.stdout || ""}${run.stderr || ""}`;
  const failedCase = output.split("\n").find((l) => l.includes("IN_TRANSIT skips when the tracking email"));

  if (run.status === 0) {
    console.error("MUTATION SURVIVED: the smoke test still passed with the guard disabled.");
    console.error("The de-duplication test is not actually asserting anything.");
    process.exitCode = 1;
  } else if (!/FAIL/.test(failedCase || "")) {
    console.error("MUTATION SURVIVED, but it failed for an unexpected reason:");
    console.error(output);
    process.exitCode = 1;
  } else {
    console.log("mutation caught: the smoke test fails when the guard is disabled");
  }
} finally {
  fs.writeFileSync(target, original);
  console.log("restored src/lib/order-email.ts");
}
