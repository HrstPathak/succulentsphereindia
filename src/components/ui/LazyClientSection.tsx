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
    <div ref={ref} style={{ minHeight }}>
      {visible ? children : null}
    </div>
  );
}
