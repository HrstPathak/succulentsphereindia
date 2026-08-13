"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Languages, Loader2, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { startTransition, useEffect, useMemo, useState } from "react";
import { useUrlQueryParams } from "@/hooks/useUrlQueryParams";
import { showErrorToast } from "@/lib/toast";

type SupportedLanguage = "en" | "hi";

interface ArticleVariant {
  title: string;
  excerpt: string;
  contentHtml: string;
}

interface ArticleLanguageExperienceProps {
  article: {
    title: string;
    excerpt: string;
    authorName: string;
    publishedAt: string;
    image: {
      url: string;
      altText: string;
      width: number;
      height: number;
    } | null;
  };
  contentHtml: string;
}

const LABELS = {
  en: {
    section: "Plant Care",
    currentLanguage: "English original",
    translatedLanguage: "Hindi translation",
    byline: "Author Name:",
    floatingTitle: "Translate",
    floatingHint: "Choose language",
    statusReady: "English view active",
    statusLoading: "Translating this article...",
    statusDone: "Hindi view ready",
  },
  hi: {
    section: "\u092a\u094d\u0932\u093e\u0902\u091f \u0915\u0947\u092f\u0930",
    currentLanguage: "\u0905\u0902\u0917\u094d\u0930\u0947\u091c\u093c\u0940 \u092e\u0942\u0932",
    translatedLanguage: "\u0939\u093f\u0902\u0926\u0940 \u0905\u0928\u0941\u0935\u093e\u0926",
    byline: "\u0932\u0947\u0916\u0915:",
    floatingTitle: "\u0905\u0928\u0941\u0935\u093e\u0926",
    floatingHint: "\u092d\u093e\u0937\u093e \u091a\u0941\u0928\u0947\u0902",
    statusReady: "\u0905\u0902\u0917\u094d\u0930\u0947\u091c\u093c\u0940 \u0935\u094d\u092f\u0942 \u0938\u0915\u094d\u0930\u093f\u092f \u0939\u0948",
    statusLoading: "\u0907\u0938 \u0932\u0947\u0916 \u0915\u093e \u0905\u0928\u0941\u0935\u093e\u0926 \u0915\u093f\u092f\u093e \u091c\u093e \u0930\u0939\u093e \u0939\u0948...",
    statusDone: "\u0939\u093f\u0902\u0926\u0940 \u0935\u094d\u092f\u0942 \u0924\u0948\u092f\u093e\u0930 \u0939\u0948",
  },
} as const;

const LANGUAGE_OPTIONS: Array<{ code: SupportedLanguage; label: string; nativeLabel: string }> = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "hi", label: "Hindi", nativeLabel: "\u0939\u093f\u0902\u0926\u0940" },
];

function formatDate(value: string, language: SupportedLanguage): string {
  if (!value) {
    return language === "hi" ? "\u0939\u093e\u0932 \u0939\u0940 \u092e\u0947\u0902 \u092a\u094d\u0930\u0915\u093e\u0936\u093f\u0924" : "Recently published";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return language === "hi" ? "\u0939\u093e\u0932 \u0939\u0940 \u092e\u0947\u0902 \u092a\u094d\u0930\u0915\u093e\u0936\u093f\u0924" : "Recently published";
  }

  return date.toLocaleDateString(language === "hi" ? "hi-IN" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function normalizeRequestedLanguage(raw: string | null): SupportedLanguage {
  const value = String(raw || "").trim().toLowerCase();
  if (value === "hi" || value === "hindi") return "hi";
  return "en";
}

function FloatingTranslateButton(props: {
  activeLanguage: SupportedLanguage;
  isLoading: boolean;
  isMenuOpen: boolean;
  statusText: string;
  onToggle: () => void;
  onSelectLanguage: (language: SupportedLanguage) => void;
}) {
  const { activeLanguage, isLoading, isMenuOpen, statusText, onToggle, onSelectLanguage } = props;
  const copy = LABELS[activeLanguage];

  return (
    <div
      className="fixed right-6 z-40 flex flex-col items-end gap-3 md:right-8"
      style={{ bottom: "calc(1.5rem + var(--sticky-cta-offset, 0px) + 7.75rem)" }}
    >
      <AnimatePresence>
        {isMenuOpen ? (
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-[220px] overflow-hidden rounded-[24px] border border-[var(--color-secondary)]/25 bg-white/95 p-3 shadow-[0_18px_42px_rgba(52,78,65,0.22)] backdrop-blur-xl"
          >
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--color-brand)]">
              <Sparkles className="h-4 w-4" />
              <span>{copy.floatingHint}</span>
            </div>

            <div className="space-y-2">
              {LANGUAGE_OPTIONS.map((language) => {
                const isActive = activeLanguage === language.code;
                return (
                  <button
                    key={language.code}
                    type="button"
                    onClick={() => onSelectLanguage(language.code)}
                    disabled={isLoading}
                    className={`w-full rounded-2xl px-4 py-3 text-left transition-all duration-300 ${
                      isActive
                        ? "bg-[var(--color-brand)] text-white shadow-[0_12px_28px_rgba(52,78,65,0.24)]"
                        : "bg-[var(--color-bg)] text-[var(--color-brand)] hover:-translate-y-0.5 hover:bg-[var(--color-secondary)]/12"
                    } ${isLoading ? "cursor-not-allowed opacity-70" : ""}`}
                  >
                    <span className="block text-sm font-semibold">{language.nativeLabel}</span>
                    <span className={`block text-xs ${isActive ? "text-white/80" : "text-[var(--color-text)]/70"}`}>
                      {language.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex items-center gap-2 rounded-2xl bg-[var(--color-bg)]/90 px-3 py-2 text-xs text-[var(--color-text)]/75">
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-[var(--color-brand)]" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-[var(--color-accent)]" />
              )}
              <span>{statusText}</span>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isMenuOpen}
        aria-label="Open translation menu"
        className="group inline-flex h-12 items-center gap-2 rounded-full border border-[color:rgba(163,177,138,0.38)] bg-[linear-gradient(145deg,#f7f4ec_0%,#ffffff_100%)] px-4 text-[var(--color-brand)] shadow-[0_14px_32px_rgba(52,78,65,0.22)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(52,78,65,0.28)] md:h-14"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-brand)] text-white md:h-10 md:w-10">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
        </span>
        <span className="text-left">
          <span className="block text-xs uppercase tracking-[0.12em] text-[var(--color-brand)]/70">{copy.floatingTitle}</span>
          <span className="block text-sm font-semibold">
            {activeLanguage === "hi" ? "\u0939\u093f\u0902\u0926\u0940" : "English"}
          </span>
        </span>
      </button>
    </div>
  );
}

export default function ArticleLanguageExperience({ article, contentHtml }: ArticleLanguageExperienceProps) {
  const { searchParams, setQueryParams } = useUrlQueryParams();
  const requestedLanguage = useMemo(
    () => normalizeRequestedLanguage(searchParams.get("lang")),
    [searchParams]
  );

  const [activeLanguage, setActiveLanguage] = useState<SupportedLanguage>("en");
  const [isLoading, setIsLoading] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [variants, setVariants] = useState<Record<SupportedLanguage, ArticleVariant>>({
    en: {
      title: article.title,
      excerpt: article.excerpt,
      contentHtml,
    },
    hi: {
      title: "",
      excerpt: "",
      contentHtml: "",
    },
  });

  const copy = LABELS[activeLanguage];
  const activeVariant = variants[activeLanguage];
  const statusText = isLoading
    ? copy.statusLoading
    : activeLanguage === "hi"
      ? copy.statusDone
      : copy.statusReady;

  useEffect(() => {
    if (requestedLanguage === "en") {
      startTransition(() => {
        setActiveLanguage("en");
      });
      return;
    }

    if (variants.hi.contentHtml || isLoading) {
      startTransition(() => {
        setActiveLanguage("hi");
      });
      return;
    }

    void translateToHindi(false);
  }, [isLoading, requestedLanguage, variants.hi.contentHtml]);

  async function translateToHindi(updateUrl: boolean) {
    if (isLoading) return;

    if (variants.hi.contentHtml) {
      startTransition(() => {
        setActiveLanguage("hi");
      });
      if (updateUrl) setQueryParams({ lang: "hi" });
      return;
    }

    setIsLoading(true);
    if (updateUrl) setQueryParams({ lang: "hi" });

    try {
      const response = await fetch("/api/blog-translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: article.title,
          excerpt: article.excerpt,
          contentHtml,
          targetLanguage: "hi",
        }),
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(String(json?.error || "Unable to translate this article."));
      }

      startTransition(() => {
        setVariants((current) => ({
          ...current,
          hi: {
            title: String(json?.title || article.title),
            excerpt: String(json?.excerpt || article.excerpt),
            contentHtml: String(json?.contentHtml || contentHtml),
          },
        }));
        setActiveLanguage("hi");
      });
    } catch (error) {
      setQueryParams({ lang: null });
      showErrorToast((error as Error).message || "Unable to translate this article.");
    } finally {
      setIsLoading(false);
    }
  }

  function switchLanguage(nextLanguage: SupportedLanguage) {
    setIsMenuOpen(false);

    if (nextLanguage === "en") {
      setQueryParams({ lang: null });
      startTransition(() => {
        setActiveLanguage("en");
      });
      return;
    }

    void translateToHindi(true);
  }

  return (
    <>
      <FloatingTranslateButton
        activeLanguage={activeLanguage}
        isLoading={isLoading}
        isMenuOpen={isMenuOpen}
        statusText={statusText}
        onToggle={() => setIsMenuOpen((current) => !current)}
        onSelectLanguage={switchLanguage}
      />

      <nav className="mb-6 text-sm text-[var(--color-text)]/75">
        <Link href="/plant-care" className="transition-colors hover:text-[var(--color-brand)]">
          {copy.section}
        </Link>
        <span className="mx-2 text-[var(--color-secondary)]">/</span>
        <span className="text-[var(--color-brand)]">{activeVariant.title || article.title}</span>
      </nav>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeLanguage}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
        >
          <header className="mb-8 md:mb-10">
            <p className="mb-3 text-xs uppercase tracking-[0.15em] text-[var(--color-secondary)]">
              {formatDate(article.publishedAt, activeLanguage)}
            </p>
            <h1 className="font-serif text-4xl leading-tight text-[var(--color-brand)] md:text-6xl">
              {activeVariant.title || article.title}
            </h1>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[var(--color-secondary)]/30 bg-white/80 px-4 py-2 text-sm text-[var(--color-text)] shadow-[0_10px_30px_rgba(52,78,65,0.08)]">
              <Sparkles className="h-4 w-4 text-[var(--color-brand)]" />
              <span>{activeLanguage === "hi" ? copy.translatedLanguage : copy.currentLanguage}</span>
            </div>
            {activeVariant.excerpt ? (
              <p className="mt-4 max-w-3xl text-base leading-8 text-[var(--color-text)]/80 md:text-lg">
                {activeVariant.excerpt}
              </p>
            ) : null}
          </header>

          <div className="overflow-hidden rounded-2xl border border-[var(--color-secondary)]/30 bg-white shadow-[0_18px_50px_rgba(52,78,65,0.12)]">
            <div className="relative aspect-[16/9] w-full">
              {article.image?.url ? (
                <Image
                  src={article.image.url}
                  alt={article.image.altText || article.title}
                  fill
                  priority
                  className="object-cover"
                  sizes="100vw"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[var(--color-secondary)]/20 text-[var(--color-brand)]/70">
                  Plant care article
                </div>
              )}
            </div>

            <article className="px-5 py-8 md:px-10 md:py-12">
              <div
                lang={activeLanguage === "hi" ? "hi" : "en"}
                className="prose prose-lg max-w-none prose-headings:font-serif prose-headings:text-[var(--color-brand)] prose-p:text-[var(--color-text)] prose-p:leading-8 prose-a:text-[var(--color-accent)] prose-strong:text-[var(--color-brand)]"
                dangerouslySetInnerHTML={{ __html: activeVariant.contentHtml || contentHtml }}
              />
              <p className="mt-8 rounded-xl border border-[var(--color-secondary)]/35 bg-[var(--color-secondary)]/8 px-4 py-3 text-sm text-[var(--color-text)]">
                <span className="font-semibold text-[var(--color-brand)]">{copy.byline}</span> {article.authorName}
              </p>
            </article>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}
