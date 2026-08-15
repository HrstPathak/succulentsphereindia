"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type LazyClientSectionProps = {
  children: ReactNode;
  minHeight?: number | string;
  rootMargin?: string;
};

export default function LazyClientSection({
  children,
  minHeight = 1,
  rootMargin = "200px 0px",
}: LazyClientSectionProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return;
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
        }
      },
      { rootMargin }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [rootMargin, visible]);

  return (
    <div ref={ref} style={{ minHeight }} aria-busy={!visible} className="relative">
      {visible ? (
        children
      ) : (
        <div className="w-full animate-pulse rounded-2xl border border-gray-200 bg-gradient-to-r from-gray-100 via-white to-gray-100 dark:border-gray-700 dark:from-gray-800 dark:via-gray-900 dark:to-gray-800" style={{ minHeight }} />
      )}
    </div>
  );
}
