import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { BLOG_PROMPT_MAX_LENGTH, readBlogPrompt, resetBlogPrompt, saveBlogPrompt } from "@/lib/blog-prompt";

const AUTH_ERROR = "ADMIN_REQUIRED";

/** Stealth-404 on non-admin access, matching the other admin routes. */
function authStatus(error: unknown): number {
  return String((error as Error).message) === AUTH_ERROR ? 404 : 500;
}

function authMessage(error: unknown, fallback: string): string {
  return String((error as Error).message) === AUTH_ERROR
    ? "Not found."
    : String((error as Error).message || error) || fallback;
}

/** The editable "Blog Post Generation Prompt" master template. */
export async function GET() {
  try {
    await requireAdmin();
    const prompt = await readBlogPrompt();
    return NextResponse.json({ ok: true, prompt });
  } catch (error) {
    return NextResponse.json(
      { error: authMessage(error, "Unable to load the blog prompt.") },
      { status: authStatus(error) },
    );
  }
}

/**
 * Save the template.
 *
 * PUT body: { content: string }  — replace the stored template
 *           { reset: true }      — restore the shipped master template
 */
export async function PUT(request: Request) {
  try {
    const session = await requireAdmin();
    const body = await request.json();
    const reset = body.reset === true;
    const content = reset ? "" : String(body.content ?? "");

    if (!reset) {
      if (!content.trim()) {
        return NextResponse.json({ error: "The prompt cannot be empty." }, { status: 400 });
      }
      if (content.length > BLOG_PROMPT_MAX_LENGTH) {
        return NextResponse.json(
          { error: `The prompt is too long (max ${BLOG_PROMPT_MAX_LENGTH.toLocaleString("en-IN")} characters).` },
          { status: 400 },
        );
      }
    }

    const prompt = reset
      ? await resetBlogPrompt(session.email)
      : await saveBlogPrompt(content, session.email);
    return NextResponse.json({ ok: true, prompt });
  } catch (error) {
    return NextResponse.json(
      { error: authMessage(error, "Unable to save the blog prompt.") },
      { status: authStatus(error) },
    );
  }
}
