"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

function ChevronLeftIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

export default function Pagination({
  page = 1,
  total = 2,
  queryString,
}: {
  page?: number;
  total?: number;
  queryString?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const safeTotal = Math.max(1, total);
  const safePage = Math.min(Math.max(1, page), safeTotal);
  const isPrevDisabled = safePage === 1;
  const isNextDisabled = safePage === safeTotal;

  const makeHref = (nextPage: number) => {
    const params = new URLSearchParams(queryString ?? searchParams?.toString() ?? "");
    params.set("page", String(nextPage));
    return `${pathname}?${params.toString()}`;
  };

  const getVisiblePages = () => {
    if (safeTotal <= 7) {
      return Array.from({ length: safeTotal }, (_, i) => i + 1);
    }

    const values = new Set<number>([1, safeTotal, safePage - 1, safePage, safePage + 1]);
    const valid = Array.from(values)
      .filter((value) => value >= 1 && value <= safeTotal)
      .sort((a, b) => a - b);

    const output: Array<number | "..."> = [];
    for (let i = 0; i < valid.length; i += 1) {
      const current = valid[i];
      const prev = valid[i - 1];
      if (i > 0 && current - prev > 1) {
        output.push("...");
      }
      output.push(current);
    }
    return output;
  };

  const visiblePages = getVisiblePages();

  return (
    <nav aria-label="Pagination" className="mt-12 mb-6">
      <p className="mb-3 text-center text-xs font-medium text-[var(--auth-muted)]">
        Page {safePage} of {safeTotal}
      </p>
      <div className="flex items-center justify-center gap-1 sm:gap-2">
      {/* Previous Button */}
      {isPrevDisabled ? (
        <button disabled className="px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg text-xs sm:text-sm font-medium text-gray-400 dark:text-gray-600 bg-gray-100 dark:bg-gray-800 cursor-not-allowed flex items-center gap-1">
          <ChevronLeftIcon />
          <span className="hidden sm:inline">Previous</span>
        </button>
      ) : (
        <Link
          href={makeHref(Math.max(1, safePage - 1))}
          prefetch={false}
          className="px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600 transition-all duration-200 flex items-center gap-1 shadow-sm hover:shadow-md"
        >
          <ChevronLeftIcon />
          <span className="hidden sm:inline">Previous</span>
        </Link>
      )}

      {/* Page Numbers */}
      <div className="flex items-center gap-1">
        {visiblePages.map((item, index) =>
          item === "..." ? (
            <span
              key={`ellipsis-${index}`}
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg text-xs sm:text-sm font-semibold text-gray-500 dark:text-gray-400 flex items-center justify-center"
              aria-hidden="true"
            >
              ...
            </span>
          ) : (
            <Link
              key={item}
              href={makeHref(item)}
              prefetch={false}
              aria-current={item === safePage ? "page" : undefined}
              className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 flex items-center justify-center ${
                item === safePage
                  ? "bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-lg shadow-emerald-600/30 scale-105"
                  : "text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 hover:text-emerald-600 dark:hover:text-emerald-400"
              }`}
            >
              {item}
            </Link>
          )
        )}
      </div>

      {/* Next Button */}
      {isNextDisabled ? (
        <button disabled className="px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg text-xs sm:text-sm font-medium text-gray-400 dark:text-gray-600 bg-gray-100 dark:bg-gray-800 cursor-not-allowed flex items-center gap-1">
          <span className="hidden sm:inline">Next</span>
          <ChevronRightIcon />
        </button>
      ) : (
        <Link
          href={makeHref(Math.min(safeTotal, safePage + 1))}
          prefetch={false}
          className="px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600 transition-all duration-200 flex items-center gap-1 shadow-sm hover:shadow-md"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRightIcon />
        </Link>
      )}
      </div>
    </nav>
  );
}

