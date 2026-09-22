"use client";

import { useEffect, useRef } from "react";

interface FullHtmlArticleProps {
  html: string;
  title: string;
  lang: "en" | "hi";
}

export default function FullHtmlArticle({ html, title, lang }: FullHtmlArticleProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !html) return;
    containerRef.current.innerHTML = html;
  }, [html]);

  return (
    <div
      ref={containerRef}
      lang={lang}
      className="prose prose-lg max-w-none prose-headings:font-serif prose-headings:text-[var(--color-brand)] prose-p:text-[var(--color-text)] prose-p:leading-8 prose-a:text-[var(--color-accent)] prose-strong:text-[var(--color-brand)]"
    />
  );
}
