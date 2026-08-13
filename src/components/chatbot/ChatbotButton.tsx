"use client";

import { useEffect, useMemo, useState } from "react";

interface ChatbotButtonProps {
  onClick: () => void;
  isOpen: boolean;
}

const BUBBLE_COPY = [
  "Hey I'm your AI Plant Assistant",
  "Hi! Need help choosing the perfect plant?",
];
const INTRO_DISMISS_KEY = "ss_assistant_intro_dismissed_at";
const INTRO_COOLDOWN_MS = 2 * 60 * 60 * 1000;

export const CONTACT = {
  WHATSAPP_NUMBER: "9458321209",
  PHONE_NUMBER: "9458321209",
};

export function ChatbotButton({ onClick, isOpen }: ChatbotButtonProps) {
  const [showIntro, setShowIntro] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const introText = useMemo(() => BUBBLE_COPY[0], []);
  const whatsappMessage =
    "Hello Succulent Sphere, I visited your website and would appreciate help with a few questions.";
  const whatsappHref = `https://wa.me/${CONTACT.WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappMessage)}`;

  useEffect(() => {
    let shouldShow = true;
    try {
      const stored = window.localStorage.getItem(INTRO_DISMISS_KEY);
      if (stored) {
        const lastDismissed = Number(stored);
        if (Number.isFinite(lastDismissed) && Date.now() - lastDismissed < INTRO_COOLDOWN_MS) {
          shouldShow = false;
          setIsDismissed(true);
        }
      }
    } catch {}

    if (!shouldShow) return;
    setIsDismissed(false);
    const timer = window.setTimeout(() => setShowIntro(true), 2000);
    return () => window.clearTimeout(timer);
  }, []);

  const dismissIntro = () => {
    if (isDismissed) return;
    setShowIntro(false);
    setIsDismissed(true);
    try {
      window.localStorage.setItem(INTRO_DISMISS_KEY, String(Date.now()));
    } catch {}
  };

  return (
    <div className="floating-offset fixed right-6 md:right-8 z-40 flex flex-col items-end gap-3">
      {!isDismissed && showIntro && !isOpen ? (
        <div
          className="assistant-bubble-float relative max-w-[240px] rounded-2xl border border-[color:rgba(203,153,126,0.5)] bg-white/80 px-4 py-3 text-sm text-[var(--color-text)] shadow-[0_16px_35px_rgba(52,78,65,0.15)] backdrop-blur-xl"
          role="status"
          aria-live="polite"
        >
          <button
            type="button"
            onClick={dismissIntro}
            className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md text-[var(--color-text)]/70 transition hover:bg-black/5 hover:text-[var(--color-text)]"
            aria-label="Dismiss assistant intro"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
          <div className="flex items-start gap-2">
            <span className="wave-emoji mt-[1px] inline-block text-base" aria-hidden="true">👋</span>
            <p className="leading-snug">{introText}</p>
          </div>
          <div className="absolute -bottom-1 right-6 h-3 w-3 rotate-45 border-b border-r border-[color:rgba(203,153,126,0.5)] bg-white/80" />
        </div>
      ) : null}

      <button
        type="button"
        onMouseEnter={dismissIntro}
        onFocus={dismissIntro}
        onClick={() => {
          dismissIntro();
          onClick();
        }}
        className="assistant-float-button group flex h-12 w-12 items-center justify-center rounded-full border border-[color:rgba(163,177,138,0.42)] bg-[linear-gradient(145deg,#344E41_0%,#456457_100%)] text-white shadow-[0_14px_30px_rgba(52,78,65,0.35)] transition-all duration-200 hover:scale-105 hover:shadow-[0_18px_36px_rgba(52,78,65,0.45)] active:scale-95 md:h-14 md:w-14"
        aria-label={isOpen ? "Close AI Plant Assistant" : "Open AI Plant Assistant"}
        title="AI Plant Assistant"
      >
        {isOpen ? (
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg
            width="34"
            height="34"
            viewBox="0 0 24 24"
            fill="none"
            className="transition-transform duration-200 group-hover:scale-110"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="7.25" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
            <path
              d="M12 6.2l1.42 3.38 3.38 1.42-3.38 1.42L12 15.8l-1.42-3.38L7.2 11l3.38-1.42L12 6.2Z"
              fill="currentColor"
            />
            <path
              d="M18.25 5.2l.6 1.45 1.45.6-1.45.6-.6 1.45-.6-1.45-1.45-.6 1.45-.6.6-1.45Z"
              fill="currentColor"
            />
            <path
              d="M6.15 15.75l.48 1.16 1.16.48-1.16.48-.48 1.16-.48-1.16-1.16-.48 1.16-.48.48-1.16Z"
              fill="currentColor"
              opacity="0.82"
            />
          </svg>
        )}
      </button>

      <a
        href={whatsappHref}
        target="_blank"
        rel="noreferrer"
        className="assistant-float-button assistant-float-whatsapp group flex h-12 w-12 items-center justify-center rounded-full border border-[color:rgba(42,163,93,0.35)] bg-[linear-gradient(145deg,#1f8f4d_0%,#2cc56f_100%)] text-white shadow-[0_12px_26px_rgba(31,143,77,0.35)] transition-all duration-200 hover:scale-105 hover:shadow-[0_16px_34px_rgba(31,143,77,0.45)] active:scale-95 md:h-14 md:w-14"
        aria-label="WhatsApp Support"
        title="WhatsApp Support"
        onMouseEnter={dismissIntro}
        onFocus={dismissIntro}
      >
        <svg
          width="34"
          height="34"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
          className="transition-transform duration-200 group-hover:scale-110"
        >
          <path d="M20.5 12.05c0 4.64-3.78 8.4-8.45 8.4-1.43 0-2.83-.36-4.07-1.04L4 20l1.04-3.79a8.3 8.3 0 0 1-1.13-4.16C3.91 7.4 7.69 3.64 12.36 3.64c4.66 0 8.14 3.76 8.14 8.41ZM12.36 5.2a6.83 6.83 0 0 0-5.83 10.4l.2.32-.6 2.18 2.25-.6.3.18a6.9 6.9 0 0 0 3.68 1.06 6.84 6.84 0 0 0 0-13.68Zm3.97 7.83c-.05-.08-.19-.13-.4-.24-.2-.1-1.18-.58-1.36-.65-.18-.07-.31-.1-.45.1-.13.2-.52.65-.64.78-.12.13-.24.15-.45.05-.2-.1-.86-.31-1.63-.98-.6-.53-1.01-1.19-1.13-1.39-.12-.2-.01-.32.09-.42.09-.09.2-.24.3-.36.1-.12.13-.2.2-.33.06-.13.03-.25-.02-.36-.05-.1-.45-1.08-.62-1.48-.16-.4-.33-.34-.45-.34-.12 0-.25-.01-.39-.01-.14 0-.36.05-.55.25-.2.2-.72.7-.72 1.7s.74 1.97.84 2.1c.1.13 1.45 2.22 3.5 3.11.49.22.88.35 1.18.45.5.16.96.14 1.32.08.4-.06 1.18-.48 1.34-.95.16-.47.16-.88.11-.97Z" />
        </svg>
        <span className="sr-only">WhatsApp Support</span>
      </a>
    </div>
  );
}
