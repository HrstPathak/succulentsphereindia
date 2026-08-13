import { NextRequest, NextResponse } from "next/server";
import { chatWithFailover, hasLLMProviderConfigured } from "../../../lib/llm";

// Simple in-memory rate limit: IP -> { count, resetAt }
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 20; // max requests per minute per IP

// Track active requests to detect high load
let activeRequests = 0;
const MAX_CONCURRENT_REQUESTS = 5; // Threshold for high load
const REQUEST_TIMEOUT_MS = 35_000; // 35 second timeout

function getClientIP(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry) return false;
  if (now > entry.resetAt) {
    rateLimitMap.delete(ip);
    return false;
  }
  return entry.count >= RATE_LIMIT_MAX;
}

function recordRequest(ip: string): void {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

/** Sanitize user input: remove script tags, limit length, block obvious prompt injection */
function sanitizeInput(text: string): string {
  const s = String(text || "")
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return s.slice(0, 500);
}

const FALLBACK_MESSAGE =
  "We're experiencing high traffic and response times are longer than usual. For faster assistance, please use our direct chat support for priority responses. Thank you for your patience!";

export async function POST(req: NextRequest) {
  const ip = getClientIP(req);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." },
      { status: 429 }
    );
  }

  if (!hasLLMProviderConfigured()) {
    return NextResponse.json(
      { error: "Chat service is not configured. Add at least one LLM provider API key." },
      { status: 503 }
    );
  }

  let body: { message?: string; history?: { role: string; content: string }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawMessage = body.message;
  const history = Array.isArray(body.history)
    ? body.history.slice(-10).map((h: any) => ({
        role: String(h?.role || "user"),
        content: sanitizeInput(String(h?.content || "")),
      }))
    : [];

  const message = sanitizeInput(rawMessage);
  if (!message || message.length < 1) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  // Check if system is under high load - if so, return fallback message
  if (activeRequests >= MAX_CONCURRENT_REQUESTS) {
    return NextResponse.json({
      message: FALLBACK_MESSAGE,
      isHighLoad: true,
    });
  }

  recordRequest(ip);
  activeRequests++;

  try {
    const { getChatbotContextAsync, buildMessages } = await import("../../../lib/chatbot-context");
    const context = await getChatbotContextAsync();
    const messages = buildMessages(context, message, history);

    // Create a timeout promise
    const timeoutPromise: Promise<never> = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Response timeout")), REQUEST_TIMEOUT_MS)
    );

    const response = await Promise.race([
      chatWithFailover(messages, {
        temperature: 0.2,
        maxNewTokens: 300,
      }),
      timeoutPromise,
    ]);

    return NextResponse.json({ message: response.content, provider: response.provider });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isTimeout = msg.includes("timeout");
    console.error("[chat] LLM error:", msg);

    const providerStatuses = Array.from(msg.matchAll(/ API (\d{3})/g)).map((m) => Number(m[1]));
    const hasProviderStatuses = providerStatuses.length > 0;
    const allCreditsExhausted = hasProviderStatuses && providerStatuses.every((s) => s === 402);
    const hasAuthError = providerStatuses.some((s) => s === 401 || s === 403);
    const hasRateLimit = providerStatuses.some((s) => s === 429);
    const hasModelOrConfigError = providerStatuses.some((s) => s === 400 || s === 404);

    if (allCreditsExhausted) {
      return NextResponse.json(
        {
          error:
            "AI credits are currently exhausted across configured providers. Please try again later or contact support.",
        },
        { status: 503 }
      );
    }

    if (hasAuthError) {
      return NextResponse.json(
        {
          error:
            "One or more AI provider API keys are invalid or unauthorized. Please verify provider keys and permissions.",
        },
        { status: 503 }
      );
    }

    if (hasModelOrConfigError) {
      return NextResponse.json(
        {
          error:
            "One or more configured AI models are unavailable for your provider accounts. Update model names or provider settings.",
        },
        { status: 503 }
      );
    }

    if (hasRateLimit || msg.includes(" API 429")) {
      return NextResponse.json(
        { error: "AI services are temporarily rate-limited. Please retry in a moment." },
        { status: 429 }
      );
    }

    // If timeout or system overloaded, return fallback message
    if (isTimeout || msg.includes("overloaded") || msg.includes("overload")) {
      return NextResponse.json({
        message: FALLBACK_MESSAGE,
        isHighLoad: true,
      });
    }

    const isDev = process.env.NODE_ENV === "development";
    return NextResponse.json(
      {
        error: "Sorry, I'm having trouble responding. Please try again.",
        ...(isDev && { detail: msg }),
      },
      { status: 500 }
    );
  } finally {
    activeRequests = Math.max(0, activeRequests - 1);
  }
}
