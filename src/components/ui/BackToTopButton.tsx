"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

export default function BackToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 320);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      aria-label="Back to top"
      title="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={`floating-offset fixed left-4 z-40 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/55 bg-[linear-gradient(145deg,#2f4f40_0%,#3f6a56_100%)] text-white shadow-[0_14px_30px_rgba(13,22,17,0.32)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(13,22,17,0.38)] md:left-8 ${
        visible ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
      }`}
    >
      <ArrowUp size={18} strokeWidth={2.2} />
    </button>
  );
}
