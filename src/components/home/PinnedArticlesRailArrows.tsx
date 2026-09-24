"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Pin } from "lucide-react";
import type { RefObject } from "react";
import type { PinnedArticleCard } from "./PinnedArticlesRail";
import { shouldBypassImageOptimization } from "@/lib/imageUrl";

function formatDateCard(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function RailArrows(props: {
  railRef: RefObject<HTMLDivElement | null>;
  canLeft: boolean;
  canRight: boolean;
  onScroll: (direction: 1 | -1) => void;
}) {
  const arrowClass =
    "hidden h-10 w-10 items-center justify-center rounded-full border border-[rgb(var(--ss-secondary-rgb)/0.35)] bg-white/90 text-[var(--color-brand)] shadow-[0_8px_20px_rgba(52,78,65,0.10)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(52,78,65,0.16)] disabled:cursor-default disabled:opacity-30 disabled:hover:translate-y-0 md:inline-flex";
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => props.onScroll(-1)}
        disabled={!props.canLeft}
        aria-label="Scroll to previous articles"
        className={arrowClass}
      >
        <ChevronLeft size={18} />
      </button>
      <button
        type="button"
        onClick={() => props.onScroll(1)}
        disabled={!props.canRight}
        aria-label="Scroll to next articles"
        className={arrowClass}
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

export function Rail({
  articles,
  railRef,
}: {
  articles: PinnedArticleCard[];
  railRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="relative">
      <div
        ref={railRef}
        className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0"
        role="list"
      >
        {articles.map((article, index) => (
          <ArticleCard key={article.id} article={article} index={index} />
        ))}

        {/* View-all card closes the rail */}
        <Link
          href="/plant-care"
          role="listitem"
          className="group flex w-[160px] flex-none snap-start flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[rgb(var(--ss-secondary-rgb)/0.5)] bg-[rgb(var(--ss-secondary-rgb)/0.06)] text-[var(--color-brand)] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--color-brand)] hover:bg-[rgb(var(--ss-secondary-rgb)/0.12)]"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-[0_8px_20px_rgba(52,78,65,0.12)] transition-transform duration-300 group-hover:scale-110">
            <ArrowRight size={16} />
          </span>
          <span className="px-3 text-center text-xs font-bold uppercase tracking-wider">All care guides</span>
        </Link>
      </div>

      {/* Soft edge fade for the premium feel (decorative) */}
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-16 bg-gradient-to-l from-[var(--color-bg)] to-transparent md:block" />
    </div>
  );
}

export function ArticleCard({ article, index }: { article: PinnedArticleCard; index: number }) {
  return (
    <article
      role="listitem"
      className="group w-[240px] flex-none snap-start overflow-hidden rounded-2xl border border-[rgb(var(--ss-secondary-rgb)/0.25)] bg-white shadow-[0_10px_28px_rgba(52,78,65,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(52,78,65,0.16)] sm:w-[260px]"
    >
      <Link href={`/plant-care/${article.handle}`} className="flex h-full flex-col">
        <div className="relative aspect-[4/3] overflow-hidden bg-[rgb(var(--ss-secondary-rgb)/0.15)]">
          {article.image?.url ? (
            <Image
              src={article.image.url}
              unoptimized={shouldBypassImageOptimization(article.image.url)}
              alt={article.image.altText || article.title}
              fill
              loading={index < 2 ? "eager" : "lazy"}
              priority={index === 0}
              sizes="260px"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.06]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-[rgb(var(--ss-brand-rgb)/0.6)]">
              Plant care guide
            </div>
          )}
          <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--color-brand)] shadow-sm backdrop-blur-sm">
            <Pin size={10} className="rotate-45" /> Pinned
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-1.5 p-4">
          {article.publishedAt ? (
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-secondary)]">
              {formatDateCard(article.publishedAt)}
            </p>
          ) : null}
          <h3 className="line-clamp-2 font-serif text-[15px] leading-snug text-[var(--color-brand)]">
            {article.title}
          </h3>
          <p className="line-clamp-2 text-xs leading-5 text-[rgb(var(--ss-text-rgb)/0.7)]">{article.excerpt}</p>
          <span className="mt-auto inline-flex items-center gap-1 pt-1.5 text-xs font-bold text-[var(--color-accent)] transition-colors group-hover:text-[var(--color-brand)]">
            Read guide
            <ArrowRight size={12} className="transition-transform duration-300 group-hover:translate-x-0.5" />
          </span>
        </div>
      </Link>
    </article>
  );
}
