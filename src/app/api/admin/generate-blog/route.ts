import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { requireAdmin } from "@/lib/admin-auth";

const AUTH_ERROR = "ADMIN_REQUIRED";

/** Stealth-404 on non-admin access, matching src/app/api/admin/articles/route.ts. */
function authStatus(error: unknown): number {
  return String((error as Error).message) === AUTH_ERROR ? 404 : 500;
}

function authMessage(error: unknown, fallback: string): string {
  return String((error as Error).message) === AUTH_ERROR
    ? "Not found."
    : String((error as Error).message || error) || fallback;
}

// Initialize Gemini Client (server-side only; key comes from .env.local).
// Model follows the project-wide GEMINI_MODEL env (see src/lib/llm.ts);
// gemini-2.5-flash is no longer available to new Google AI projects.
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";

// Output Schema to ensure structured JSON output
const blogResponseSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Catchy, SEO-friendly title" },
    slug: { type: Type.STRING, description: "URL-friendly slug generated from title" },
    metaDescription: { type: Type.STRING, description: "150-character summary for SEO" },
    content: { type: Type.STRING, description: "Full article body formatted in standard Markdown" },
    tags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of 3-5 relevant category tags",
    },
  },
  required: ["title", "slug", "metaDescription", "content", "tags"],
} as const;

// Model fallback chain, mirroring GEMINI_MODEL_FALLBACK in .env.local and the
// provider-fallback pattern in src/lib/llm.ts: primary model first, then the
// "latest" alias. 503 "high demand" (UNAVAILABLE) is retried on the next model.
const GEMINI_MODEL_CHAIN = [
  GEMINI_MODEL,
  process.env.GEMINI_MODEL_FALLBACK || "gemini-flash-latest",
].filter((m, i, arr) => m && arr.indexOf(m) === i);

// One shared per-attempt config; only the model changes between tries.
function blogPrompt(topic: string) {
  return `Write a comprehensive, engaging, and well-researched blog post about the following topic: "${topic.trim()}".`;
}

const blogRequestConfig = {
  responseMimeType: "application/json",
  responseSchema: blogResponseSchema,
  temperature: 0.7,
};

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const { topic } = await request.json();

    if (!topic || !String(topic).trim()) {
      return NextResponse.json({ error: "Topic is required" }, { status: 400 });
    }

    const contents = blogPrompt(String(topic));
    let response;
    let lastError: unknown;

    // Try each model in the chain. Transient 503 "high demand" spikes are the
    // norm on free-tier Flash models, so back off and retry before moving on:
    // 2 attempts on the primary model (4s, 10s waits), then the fallback alias.
    for (const model of GEMINI_MODEL_CHAIN) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          response = await ai.models.generateContent({
            model,
            contents,
            config: blogRequestConfig,
          });
          break;
        } catch (error) {
          lastError = error;
          const status = (error as { status?: number })?.status;
          if (status === 503 && attempt < 3) {
            await new Promise((resolve) => setTimeout(resolve, attempt === 1 ? 4000 : 10000));
            continue;
          }
          break;
        }
      }
      if (response) break;
    }

    if (!response) {
      throw lastError instanceof Error
        ? lastError
        : new Error("Gemini is temporarily unavailable — please try again.");
    }

    const blogData = JSON.parse(response.text || "{}");

    return NextResponse.json({ ok: true, data: blogData });
  } catch (error) {
    console.error("Error generating post:", error);
    return NextResponse.json(
      { error: authMessage(error, "Unable to generate blog post.") },
      { status: authStatus(error) }
    );
  }
}