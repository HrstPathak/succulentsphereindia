"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Pin } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Rail, RailArrows } from "./PinnedArticlesRailArrows";

export type PinnedArticleCard = {
  id: string;
  handle: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  image: { url: string; altText: string } | null;
};

function formatDate(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Premium minimal horizontal-scroll rail for pinned plant-care articles.
 * Renders on the home page above the footer. Cards are small, image-first,
 * and lazy-loaded (images + section content below the fold).
 */
export default function PinnedArticlesRail({ articles }: { articles: PinnedArticleCard[] }) {
  const railRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 8);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = railRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", updateArrows);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      window.removeEventListener("resize", updateArrows);
    };
  }, [updateArrows]);

  function scrollBy(direction: 1 | -1) {
    const el = railRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.min(el.clientWidth * 0.8, 560), behavior: "smooth" });
  }

  if (!articles.length) return null;

  return (
    <section aria-labelledby="pinned-articles-heading" className="relative">
      <div className="mb-6 flex items-end justify-between gap-4 md:mb-8">
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-secondary)]">
            Plant Care Journal
          </p>
          <h2
            id="pinned-articles-heading"
            className="font-serif text-2xl leading-tight text-[var(--color-brand)] md:text-4xl"
          >
            Care guides, pinned for you
          </h2>
        </div>
        <RailArrows railRef={railRef} canLeft={canLeft} canRight={canRight} onScroll={scrollBy} />
      </div>
      <Rail articles={articles} railRef={railRef} />
    </section>
  );
}
