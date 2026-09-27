import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import { sendPasswordResetEmail } from "@/lib/send-reset-email";

/**
 * POST /api/forgot-password
 *
 * Mints a Firebase reset link and mails it as a branded email, instead of
 * handing the address to `accounts:sendOobCode` and letting Firebase send its
 * own unbranded template.
 *
 * Two properties of this endpoint are load-bearing and easy to lose in a
 * rewrite, so both are asserted here rather than left to the callee:
 *
 *   1. The response is identical whether or not the address has an account.
 *      Any difference — a status code, a message, a timing difference — turns
 *      this into an account-enumeration oracle, and it is unauthenticated.
 *   2. It is rate limited, because it costs a live email send per call. That
 *      was already true before this change (Firebase's endpoint sent mail too),
 *      so the limit is not closing a new hole — but this Gmail account is the
 *      from-address for every order email, so exhausting it would damage far
 *      more than signups.
 */

/** Requests allowed per key per window. */
const RATE_LIMIT = 3;
/** Window length, milliseconds. */
const RATE_WINDOW_MS = 15 * 60 * 1000;

function rateLimitKey(request: Request, email: string): string {
  // Both halves matter: the address alone would let one attacker lock a
  // customer out of resetting, and the IP alone would punish a whole office or
  // carrier NAT behind it. Together, one party has to exhaust their own budget.
  const forwarded = request.headers.get("x-forwarded-for") || "";
  const ip = forwarded.split(",")[0]?.trim() || "unknown";
  return `rl:reset:${ip}:${email}`;
}

/**
 * Best-effort fixed-window counter.
 *
 * Fails OPEN: if Redis is unconfigured or unreachable the request proceeds.
 * That is the same trade every helper in redis.ts makes — a cache is an
 * optimisation, never a dependency — and the alternative is an outage in the
 * rate limiter taking password resets offline for every real customer.
 */
async function rateLimited(key: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.pexpire(key, RATE_WINDOW_MS);
    return count > RATE_LIMIT;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const { email } = await request.json();
  const safeEmail = String(email || "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(safeEmail))
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );

  const generic = {
    ok: true,
    message: "If your email exists, you will receive reset instructions shortly.",
  };

  // Over the limit: return the generic success body rather than a 429. Telling
  // a caller they are being rate limited still confirms the request was
  // processed, which is the disclosure this endpoint exists to avoid.
  if (await rateLimited(rateLimitKey(request, safeEmail))) {
    return NextResponse.json(generic);
  }

  try {
    const result = await sendPasswordResetEmail({
      email: safeEmail,
      // Firebase only accepts an action URL on an authorised domain, so this
      // has to be the real site origin; the emailed link is built from it too.
      siteUrl: new URL(request.url).origin,
    });
    if (result.skipped && result.reason === "user_not_found") {
      console.log(`[forgot-password] no account for ${safeEmail}`);
    }
  } catch {
    // Do not disclose whether an address has an account, and do not surface a
    // provider or Firebase failure to an unauthenticated caller.
  }
  return NextResponse.json(generic);
}
