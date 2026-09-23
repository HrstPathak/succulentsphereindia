import "server-only";

import { getFirebaseDb } from "@/lib/firebase-admin";

/**
 * The master "Blog Post Generation Prompt" template for the Plant Care blog.
 *
 * The live copy the team uses lives in Firestore (`blogSettings/prompt`) so it
 * can be edited from the admin UI (Plant Care Blog → Prompt → Edit) without a
 * deploy. This constant is the shipped default and the value restored by the
 * "Restore default template" action.
 */

/** Collection + doc that hold the editable prompt template. */
const BLOG_PROMPT_COLLECTION = "blogSettings";
const BLOG_PROMPT_DOC_ID = "prompt";

/** Guard rail — Firestore documents are capped at 1 MB. */
export const BLOG_PROMPT_MAX_LENGTH = 100_000;

export type BlogPromptRecord = {
  content: string;
  /** True when `content` matches the template shipped with the app. */
  isDefault: boolean;
  updatedAt: string;
  updatedBy: string;
};

export const DEFAULT_BLOG_PROMPT_TEMPLATE = `# Succulent Sphere — Blog Post Generation Prompt (Master Template)

Copy this whole file for every new post. Fill in the blanks in the FILL-IN block, then hand the rest to Claude as-is — the rules below don't change post to post.

═══════════════════════════════════════════
FILL THIS IN FOR EACH NEW POST
═══════════════════════════════════════════
TOPIC:
PRIMARY KEYWORD:
SECONDARY KEYWORDS: (2–4 related phrases)
TARGET WORD COUNT: (900–1200 for a how-to / 1500–2200 for a full guide)
PRODUCT TO LINK: (product name) — (succulentsphere.com/shop link, or a specific product URL if you have one)
INTERNAL POSTS TO LINK: (1–3 existing post titles/URLs, if any)
CITY/REGION FOCUS: (optional — e.g. Bangalore, Pune, "north India winters" — leave blank for pan-India)
TONE: (optional — default is natural conversational; write "easy language" for a simpler, plain-spoken version)
═══════════════════════════════════════════
You are writing a blog post for succulentsphere.com, an Indian succulent/plant-care and e-commerce brand. Follow every rule below without exception.

## STEP 0 — RESEARCH FIRST, WRITE SECOND

Before drafting, actually think through (or search, if you have that ability):
- What do the top 3–5 ranking pages for the PRIMARY KEYWORD currently cover, and what do they leave out or get generic about?
- What would an Indian grower in a specific climate zone (coastal humid, north Indian dry heat, hill-station cool) actually experience differently that a US/UK blog wouldn't mention?
- What's the one claim in this topic that most blogs get slightly wrong or oversimplify? Lead with correcting that — it's your differentiation.

Note 2–3 lines of what you found before drafting, so the piece has an actual point of view instead of restating common knowledge.

## VOICE & HUMANIZATION — vary this every time, across the whole series, not just this post

Don't reuse the same anecdote, city, or failure story used in any earlier post in the series. Before writing, pick ONE combination from this rotation (don't default to the first option — actively vary it):

- **CITY/CLIMATE:** Mumbai monsoon · Delhi peak summer · Bangalore mild-but-unpredictable weather · Pune dry heat · Chennai humidity · Kolkata monsoon · a hill-station reader in Himachal/Ooty with the opposite problem (too cold, too much rain)
- **FAILURE TYPE:** overwatered out of anxiety · underwatered from neglect during a busy work week · bought from a roadside vendor with bad soil already in the pot · kept a gifted succulent in a dark corner because it "looked good there" · moved plants indoors for AC and they suffered · left plants with a neighbour for a trip and came back to disaster · a customer support message that turned out to be a mix-up, not a plant problem · a topic-specific mistake unique to this post's subject
- **OPENING STYLE:** rotate between — a direct mistake-confession opener, a reader question opener, a myth-busting opener, a straight factual opener with any anecdote moved to the middle instead of the top

Other rules:
- Not every post needs a personal failure story. Sometimes a customer story, a friend's mistake, or no anecdote at all (just a confident, specific opinion) reads more natural. Use judgment — don't force one in if it feels bolted on.
- Vary sentence length aggressively — some sentences 4 words, some 30+. Break the uniform rhythm that reads as AI-written.
- Avoid AI "tells": "In today's fast-paced world," "Let's dive in," "It's important to note," excessive em-dashes, perfectly symmetrical 3-point lists for everything, "Moreover/Furthermore/Additionally" chains, ending every section with a neat summary sentence.
- Use contractions naturally (don't, you'll, it's).
- Include ONE mild imperfection per post, varied each time: a rhetorical question, a parenthetical aside, an informal opinion, a mid-sentence correction.
- Use real Indian specifics (nursery types, INR pricing, monsoon/summer/winter as seasons) — never generic "spring/fall" advice, never invented cliché phrases.
- Never state a fact you can't stand behind. If unsure of a specific number, give a realistic range, not a suspiciously precise AI-style stat.
- If TONE says "easy language": short sentences, everyday words, no jargon without an immediate plain explanation, shorter paragraphs than usual.

## SEO (India-specific)

- Primary keyword in: SEO title (front-loaded), first 100 words of the body, one H2, meta description, one image alt/generation-prompt.
- Use semantic/LSI variations naturally — don't repeat the exact keyword robotically.
- One H2 phrased as a real "People Also Ask"-style question, answered directly in 40–60 words right below it (featured-snippet bait).
- SEO title under 60 characters, SEO description under 155 characters, both with the primary keyword and a reason to click.
- FAQ section: 4–6 real PAA-style questions.
- E-E-A-T: specific, checkable claims (a named variety, a specific fix) over vague filler. Hedge any belief-based content (Vastu, folk remedies, etc.) as belief, not fact — never invent statistics, studies, or expert/text citations.
## METADATA COMMENT BLOCK — required, goes first in the file

This blog runs through an admin auto-fill parser that reads a leading HTML comment block, extracts these fields into the CMS's own Title / Excerpt / SEO title / SEO description / Tags / Hero image fields, and strips the comments out of the stored body. So every post starts with exactly this block, in this format (case of the keys can vary slightly, but keep this casing as the standard):

\`\`\`html
<!-- SEO title : [under 60 characters, primary keyword near the front] -->
<!-- SeO Description : [under 155 characters, primary keyword + a reason to click] -->
<!-- Title : [the actual post title, front-loaded with the primary keyword] -->
<!-- Excerpt : [2–3 sentences, for listing pages/social preview] -->
<!-- Tags : [3–6 comma-separated tags, lowercase-hyphenated] -->
<!-- heroImage : https://whitesmoke-cattle-754161.hostingersite.com/sites/images/blog/[cover-filename].webp -->
\`\`\`

Rules for this block:
- These are the ONLY places Title, Excerpt, SEO title, SEO description, and the hero/cover image appear. They are metadata for the CMS to auto-fill from — never repeat them inside the visible post body.
- The body must NOT contain an \`<h1>\` with the title, must NOT contain an excerpt-style summary paragraph, and must NOT contain a hero \`<img>\` tag — the CMS renders the title and hero image from these fields on its own template, separately from the content HTML.
- The heroImage URL follows the exact same filename convention as in-body images (see IMAGES below) and points at a cover-format image — this is the one image that does NOT get embedded in the visible content.
- The body should simply start with the opening paragraph (the myth-busting/reader-question/etc. opener), then move into the H2 sections as normal.

## STRUCTURE

- Word count per TARGET WORD COUNT.
- Short paragraphs (2–4 sentences) — Indian mobile readers scan.
- H2s as real questions or specific claims, never generic labels like "Conclusion."
- Link to PRODUCT TO LINK naturally once mid-content and once near the end — descriptive anchor text, never "click here." Link to INTERNAL POSTS TO LINK where topically relevant, also with descriptive anchors.
- A step-by-step section (numbered) where the topic genuinely has a procedure to follow, and a "what NOT to do" section calling out common mistakes — include these whenever they fit the topic, not just when explicitly asked.

## IMAGES

- Exactly 2 images inside the visible body (not counting the hero/cover image, which lives only in the \`heroImage\` comment).
- Every image src follows this exact pattern, with only the filename changing:
  \`https://whitesmoke-cattle-754161.hostingersite.com/sites/images/blog/[unique-name].webp\`
- The filename: lowercase, hyphen-separated, no spaces, no special characters, descriptive of the image content (e.g. \`jade-plant-southeast-corner-balcony\`), always ending in \`.webp\`.
- The \`alt\` attribute is NOT normal alt text — put a full, descriptive image-generation prompt there instead, written for an AI image generator (composition, lighting, subject, color palette, style, and explicitly "no text, no logos, no people" unless people are needed).
- The same rule applies to the hero/cover image referenced in the \`heroImage\` comment — it needs its own generation prompt, provided in the image table below, even though it isn't embedded in the body.
- After the HTML, always provide a table listing every image filename used — the 2 in-body images plus the 1 hero/cover image — next to its exact generation prompt, so the two can be matched easily:

  | Filename | Generation prompt |
  |---|---|
  | succulent-dancing | prompt for making that image |
## OUTPUT FORMAT

- The metadata comment block first, exactly as specified above.
- Then the post body as HTML with embedded/inline CSS (a single wrapping container class, no \`<!DOCTYPE>\`/\`<head>\`/\`<body>\` tags — this is a content-HTML fragment for the CMS's content field, not a full standalone page). No JavaScript.
- FAQ section as a native \`<details>\`/\`<summary>\` accordion (works without JS).
- After the HTML, provide only:
  1. The image + generation-prompt table (in-body images and the hero/cover image together)
  2. Anything worth flagging (assumed product URL, assumed internal link, etc.)

  Do not re-print the Title, Excerpt, SEO title, or SEO description separately in the chat reply — they already live in the metadata comment block, and repeating them outside it defeats the point of the auto-fill.

## DO NOT

- Invent statistics, studies, or expert names.
- Copy phrasing from any competitor site.
- Use stock AI phrases listed above.
- Reuse an anecdote, city, or opening style from any earlier post in this series.
- Make medical/scientific claims without hedging appropriately.
- Leave the image src pattern, filename format, or \`.webp\` extension inconsistent between images within the same post or across posts.
- Put the Title, Excerpt, SEO title, SEO description, or hero image anywhere in the visible post body — comment block only.`;

/** Trim-normalised compare so re-saving the shipped text still counts as default. */
function isDefaultContent(content: string): boolean {
  return content.trim() === DEFAULT_BLOG_PROMPT_TEMPLATE.trim();
}

function toRecord(content: string, data: Record<string, unknown> = {}): BlogPromptRecord {
  return {
    content,
    isDefault: isDefaultContent(content),
    updatedAt: String(data.updatedAt || ""),
    updatedBy: String(data.updatedBy || ""),
  };
}

/** The template saved by the team, or the shipped default when nothing is stored. */
export async function readBlogPrompt(): Promise<BlogPromptRecord> {
  const snapshot = await getFirebaseDb().collection(BLOG_PROMPT_COLLECTION).doc(BLOG_PROMPT_DOC_ID).get();
  const data = (snapshot.data() || {}) as Record<string, unknown>;
  const saved = String(data.content || "").trim();
  return saved ? toRecord(saved, data) : toRecord(DEFAULT_BLOG_PROMPT_TEMPLATE);
}

/** Persist an edited template (trimmed) and echo back the stored record. */
export async function saveBlogPrompt(content: string, updatedBy: string): Promise<BlogPromptRecord> {
  const value = String(content ?? "");
  const trimmed = value.trim();
  if (!trimmed) throw new Error("The prompt cannot be empty.");
  if (value.length > BLOG_PROMPT_MAX_LENGTH) {
    throw new Error(`The prompt is too long (max ${BLOG_PROMPT_MAX_LENGTH.toLocaleString("en-IN")} characters).`);
  }

  const record = { content: trimmed, updatedAt: new Date().toISOString(), updatedBy: String(updatedBy || "") };
  await getFirebaseDb().collection(BLOG_PROMPT_COLLECTION).doc(BLOG_PROMPT_DOC_ID).set(record, { merge: true });
  return toRecord(record.content, record);
}

/** Restore the shipped master template. */
export async function resetBlogPrompt(updatedBy: string): Promise<BlogPromptRecord> {
  return saveBlogPrompt(DEFAULT_BLOG_PROMPT_TEMPLATE, updatedBy);
}
