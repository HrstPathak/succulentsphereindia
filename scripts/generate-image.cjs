/**
 * One-off Gemini image generation utility.
 *
 * Usage:
 *   node scripts/generate-image.cjs "<prompt>" [output-name] [aspect-ratio]
 *
 * - Prompt is required; output defaults to public/images/generated-<timestamp>.png
 * - Aspect ratio defaults to "16:9".
 * - API key is read from .env.local (GEMINI_API_KEY), same as the blog API.
 * - Model chain mirrors src/app/api/admin/generate-blog/route.ts: stable
 *   primary (gemini-3-pro-image) first, then the older fallback, with the
 *   same retry-on-503 policy.
 */
const fs = require("fs");
const path = require("path");

async function main() {
  const prompt = process.argv[2];
  if (!prompt || !prompt.trim()) {
    console.error("Usage: node scripts/generate-image.cjs \"<prompt>\" [output-name] [aspect-ratio]");
    process.exit(1);
  }
  const aspectRatio = process.argv[4] || "16:9";
  const outName = process.argv[3] || `generated-${Date.now()}.png`;
  const outPath = path.join(__dirname, "..", "public", "images", outName);

  const env = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
  const apiKey = (env.match(/^GEMINI_API_KEY=(.+)$/m) || [])[1]?.trim();
  if (!apiKey) {
    console.error("GEMINI_API_KEY not found in .env.local");
    process.exit(1);
  }

  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey });

  // Stable image models available to this key (probed via v1beta/models).
  const MODEL_CHAIN = ["gemini-3-pro-image", "gemini-2.5-flash-image"];

  let imagePart = null;
  let usedModel = null;
  let lastError = null;

  for (const model of MODEL_CHAIN) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[image-gen] trying model=${model} attempt=${attempt} ratio=${aspectRatio}`);
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: { imageConfig: { aspectRatio } },
        });
        const parts = response.candidates?.[0]?.content?.parts || [];
        imagePart = parts.find((p) => p.inlineData?.data);
        if (imagePart) {
          usedModel = model;
          break;
        }
        lastError = new Error("No inline image part in response");
        break;
      } catch (error) {
        lastError = error;
        const status = error?.status;
        if ((status === 503 || status === 429) && attempt < 3) {
          await new Promise((r) => setTimeout(r, attempt === 1 ? 4000 : 10000));
          continue;
        }
        break;
      }
    }
    if (imagePart) break;
    console.warn(`[image-gen] model ${model} failed: ${String(lastError?.message || lastError)}`);
  }

  if (!imagePart) {
    console.error("[image-gen] all models failed:", String(lastError?.message || lastError));
    process.exit(1);
  }

  const mime = imagePart.inlineData.mimeType || "image/png";
  const ext = mime.includes("jpeg") ? "jpg" : mime.includes("webp") ? "webp" : "png";
  const finalPath = outPath.replace(/\.(png|jpg|webp)$/i, `.${ext}`);
  fs.writeFileSync(finalPath, Buffer.from(imagePart.inlineData.data, "base64"));
  const kb = (fs.statSync(finalPath).size / 1024).toFixed(0);
  console.log(`[image-gen] OK model=${usedModel} -> ${finalPath} (${kb} KB)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
