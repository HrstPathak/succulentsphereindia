// One-off probe: list Gemini models with image generation support.
const fs = require("fs");
const key = (fs.readFileSync(".env.local", "utf8").match(/^GEMINI_API_KEY=(.+)$/m) || [])[1].trim();
fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=" + key)
  .then((r) => r.json())
  .then((d) => {
    if (d.error) return console.log("ERR", JSON.stringify(d.error));
    const models = (d.models || []).filter(
      (m) =>
        /image|imagen|nano/i.test(m.name) &&
        (m.supportedGenerationMethods || []).some((s) => /generateContent|predict/i.test(s))
    );
    console.log(JSON.stringify(models.map((m) => ({ name: m.name, methods: m.supportedGenerationMethods })), null, 1));
  })
  .catch((e) => console.log("FAIL", e.message));
