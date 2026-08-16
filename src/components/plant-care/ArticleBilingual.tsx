"use client";

import React, { useEffect, useState } from "react";
import YourSucculentsArticle from "./YourSucculentsArticle";

function sanitizeHtml(html: string) {
  // Basic sanitization: remove scripts and inline event handlers
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+=\"[^\"]*\"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "");
}

export default function ArticleBilingual({
  handle = "your-succulents-just-arrived",
}: {
  handle?: string;
}) {
  const [lang, setLang] = useState<"en" | "hi">(() => {
    try {
      return (localStorage.getItem("ss_lang") as "en" | "hi") || "en";
    } catch {
      return "en";
    }
  });
  const [hindiHtml, setHindiHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem("ss_lang", lang);
    } catch {}

    if (lang === "hi" && hindiHtml == null) {
      setLoading(true);
      fetch(`/articles/your-succulents-arrived.html`, { cache: "no-store" })
        .then((r) => {
          if (!r.ok) throw new Error("Failed to load Hindi article");
          return r.text();
        })
        .then((text) => {
          const m = text.match(/<div class="wrap">([\s\S]*?)<\/div>/i);
          const inner = m ? m[1] : text;
          setHindiHtml(sanitizeHtml(inner));
          setLoading(false);
        })
        .catch((err) => {
          console.error(err);
          setError("हिंदी लेख लोड नहीं हुआ।" + (err?.message ? ` ${err.message}` : ""));
          setLoading(false);
        });
    }
  }, [lang]);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 18 }}>
        <button
          onClick={() => setLang("en")}
          aria-pressed={lang === "en"}
          style={{
            padding: "8px 14px",
            borderRadius: 999,
            border: lang === "en" ? "2px solid #AC4B2C" : "1px solid rgba(0,0,0,0.08)",
            background: lang === "en" ? "#AC4B2C" : "#fff",
            color: lang === "en" ? "#fff" : "#333",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          English
        </button>
        <button
          onClick={() => setLang("hi")}
          aria-pressed={lang === "hi"}
          style={{
            padding: "8px 14px",
            borderRadius: 999,
            border: lang === "hi" ? "2px solid #AC4B2C" : "1px solid rgba(0,0,0,0.08)",
            background: lang === "hi" ? "#AC4B2C" : "#fff",
            color: lang === "hi" ? "#fff" : "#333",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          हिन्दी
        </button>
        <div style={{ marginLeft: 12, fontSize: 13, color: "#5b543f" }}>Toggle language</div>
      </div>

      {lang === "en" && <YourSucculentsArticle />}

      {lang === "hi" && (
        <div>
          {loading && <div style={{ padding: 12, color: "#5b543f" }}>लोड हो रहा है…</div>}
          {error && <div style={{ padding: 12, color: "#9C3B2C" }}>{error}</div>}
          {!loading && hindiHtml && (
            <div dangerouslySetInnerHTML={{ __html: hindiHtml }} />
          )}
        </div>
      )}
    </div>
  );
}
