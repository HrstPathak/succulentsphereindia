"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, Sparkles, X } from "lucide-react";
import { showErrorToast } from "@/lib/toast";

export default function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [alreadySubscribed, setAlreadySubscribed] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    try {
      const response = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const json = await response.json();
      if (!response.ok) {
        showErrorToast(String(json?.error || "Unable to subscribe right now."));
        return;
      }

      setEmail("");
      setAlreadySubscribed(Boolean(json?.alreadySubscribed));
      setOpen(true);
    } catch (error) {
      showErrorToast((error as Error).message || "Unable to subscribe right now.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form className="w-full" aria-label="Subscribe to newsletter" onSubmit={onSubmit}>
        <label htmlFor="footer-email" className="sr-only">
          Email address
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="footer-email"
            type="email"
            autoComplete="email"
            placeholder="Enter your email"
            className="w-full rounded-xl border border-black/10 bg-white/80 px-4 py-3 text-sm shadow-sm placeholder:text-[var(--color-text)]/60 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] dark:bg-black/20"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-[var(--color-brand)] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] disabled:cursor-not-allowed disabled:opacity-80"
          >
            {loading ? "Subscribing..." : "Subscribe"}
          </button>
        </div>
      </form>

      {open ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/35 backdrop-blur-[2px]"
            aria-label="Close subscription message"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Plant community subscription success"
            className="relative w-full max-w-xl overflow-hidden rounded-[30px] border border-[#d6c5ae] bg-[linear-gradient(160deg,#fffdf8_0%,#f8f1e6_54%,#edf3e9_100%)] p-7 shadow-[0_42px_85px_-44px_rgba(25,44,36,0.8)] sm:p-9"
          >
            <div className="pointer-events-none absolute inset-x-8 top-0 h-[2px] bg-[linear-gradient(90deg,transparent_0%,#94a988_20%,#d5bc9f_50%,#94a988_80%,transparent_100%)]" />
            <div className="pointer-events-none absolute left-0 right-0 top-14 mx-auto h-px w-20 bg-[#d8cab7]" />
            <div className="pointer-events-none absolute -bottom-20 -left-16 h-44 w-44 rounded-full bg-[#dee9d7]/55 blur-3xl" />
            <div className="pointer-events-none absolute -top-20 -right-16 h-44 w-44 rounded-full bg-[#f0dfcc]/55 blur-3xl" />
            <div className="absolute right-5 top-5">
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#cdbca7] bg-white/90 text-[#2f4438] transition hover:bg-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-[#d7c8b6] bg-white/90 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-[#395242]">
              <Sparkles size={13} />
              INNER GARDEN
            </div>
            <div className="text-center">
              <div className="mx-auto mb-5 inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#2f4a3f]/20 bg-[#355949] text-white shadow-[0_14px_26px_-18px_rgba(18,35,28,0.95)]">
                <CheckCircle2 size={18} />
              </div>
              <h3 className="font-playfair text-[38px] leading-[1.04] text-[#24372d] sm:text-[44px]">
                {alreadySubscribed ? "Already in Our Inner Garden" : "Welcome to Our Inner Garden"}
              </h3>
              {alreadySubscribed ? (
                <>
                  <p className="mx-auto mt-4 max-w-[34ch] text-sm leading-7 text-[#3f5247] sm:text-[15px]">
                    This email is already part of the Succulent Sphere Plant Community.
                  </p>
                  <p className="mx-auto mt-2 max-w-[40ch] text-sm leading-7 text-[#3f5247] sm:text-[15px]">
                    You are on the list for thoughtful care notes, new arrivals, feature updates, and private offers.
                  </p>
                </>
              ) : (
                <>
                  <p className="mx-auto mt-4 max-w-[40ch] text-sm leading-7 text-[#3f5247] sm:text-[15px]">
                    Thank you for joining Succulent Sphere Plant Community. You will receive curated care guidance,
                    early access to new arrivals, refined feature updates, and member-only offers.
                  </p>
                  <p className="mx-auto mt-2 max-w-[36ch] text-sm leading-7 text-[#3f5247] sm:text-[15px]">
                    Every update will be elegant, useful, and worth opening.
                  </p>
                </>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mx-auto mt-6 inline-flex items-center justify-center rounded-full border border-[#cdbca7] bg-white/95 px-5 py-2 text-xs font-semibold tracking-[0.12em] text-[#2f4438] transition hover:bg-white"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
