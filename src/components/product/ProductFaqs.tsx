"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { ProductFaq } from "@/lib/product-faqs";

type Props = {
  faqs?: ProductFaq[] | null;
  productTitle?: string;
};

export default function ProductFaqs({ faqs, productTitle }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const sectionId = useId();
  const title = String(productTitle || "this plant").trim();
  const items = Array.isArray(faqs) ? faqs : [];

  if (items.length === 0) {
    return null;
  }

  return (
    <section
      className="relative overflow-hidden rounded-[32px] border border-black/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(248,248,250,0.94)_100%)] px-5 py-8 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.35)] ring-1 ring-white/70 backdrop-blur-xl md:px-8 md:py-10 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(20,22,28,0.96)_0%,rgba(15,17,22,0.94)_100%)] dark:ring-white/5 dark:shadow-[0_28px_90px_-50px_rgba(0,0,0,0.72)]"
      aria-labelledby={`${sectionId}-title`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(280px_180px_at_0%_0%,rgba(255,255,255,0.95),transparent_62%),radial-gradient(240px_160px_at_100%_0%,rgba(227,231,238,0.58),transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.22),transparent_45%)] dark:bg-[radial-gradient(280px_180px_at_0%_0%,rgba(255,255,255,0.08),transparent_62%),radial-gradient(240px_160px_at_100%_0%,rgba(102,112,133,0.16),transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.04),transparent_45%)]" />
      <div className="relative">
        <span className="inline-flex rounded-full border border-black/8 bg-white/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#6b7280] dark:border-white/10 dark:bg-white/5 dark:text-[#a1a8b5]">
          Support
        </span>
        <div className="mt-5 max-w-3xl">
          <h2
            id={`${sectionId}-title`}
            className="text-[2rem] font-semibold tracking-[-0.04em] text-[#101214] dark:text-[var(--color-text)] md:text-[2.9rem]"
          >
            Frequently Asked Questions
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#6b7280] dark:text-[#9ca3af] md:text-base">
            Clear answers for the details people usually want to know before ordering {title}.
          </p>
        </div>

        <div className="mt-8 overflow-hidden rounded-[28px] border border-black/6 bg-white/72 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] dark:border-white/10 dark:bg-white/[0.03] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          {items.map((faq, index) => {
            const isOpen = openIndex === index;
            const answerId = `${sectionId}-answer-${index}`;
            const questionId = `${sectionId}-question-${index}`;

            return (
              <div
                key={`${faq.question}-${index}`}
                className={`overflow-hidden transition-colors duration-300 ${
                  index > 0 ? "border-t border-black/6 dark:border-white/10" : ""
                } ${isOpen ? "bg-white/92 dark:bg-white/[0.045]" : "bg-transparent hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"}`}
              >
                <h3>
                  <button
                    id={questionId}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={answerId}
                    className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left md:px-7 md:py-6"
                    onClick={() => setOpenIndex((current) => (current === index ? null : index))}
                  >
                    <span className="pr-4 text-[15px] font-medium leading-6 tracking-[-0.02em] text-[#111827] dark:text-[var(--color-text)] md:text-[1.06rem]">
                      {faq.question}
                    </span>
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-all duration-300 ${
                        isOpen
                          ? "border-black/10 bg-[#111827] text-white shadow-[0_10px_30px_-18px_rgba(17,24,39,0.9)] dark:border-white/15 dark:bg-white dark:text-[#111827]"
                          : "border-black/8 bg-white text-[#6b7280] dark:border-white/12 dark:bg-white/[0.05] dark:text-[#c6cbd4]"
                      }`}
                      aria-hidden="true"
                    >
                      <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} strokeWidth={2.1} />
                    </span>
                  </button>
                </h3>

                <div
                  id={answerId}
                  role="region"
                  aria-labelledby={questionId}
                  className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-out ${
                    isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="min-h-0">
                    <div className="border-t border-black/6 px-5 pb-6 pt-0 dark:border-white/10 md:px-7">
                      <div className="pb-1 pt-1 text-[15px] leading-7 text-[#4b5563] dark:text-[#b8c0cc] md:max-w-3xl">
                        <p className="whitespace-pre-line">{faq.answer}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
