"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

const items = [
  {
    id: 1,
    name: "Atul K.",
    quote: "Absolutely in love with my new plants. Exceptional quality and service.",
    rating: 5,
  },
  {
    id: 2,
    name: "Nishtha S.",
    quote: "Beautiful pots and healthy succulent plants, arrived perfectly packaged.",
    rating: 5,
  },
  {
    id: 3,
    name: "Janhvi A.",
    quote: "Luxury feel and fast delivery. Highly recommend.",
    rating: 4,
  },
];

const AUTO_SCROLL_MS = 5000;
/**
 * The track holds three copies of the reviews so the rail can wrap without ever
 * showing a blank edge. Only the middle copy is the "real" one: autoplay and the
 * dots operate within that range, and stepping off either end lands on
 * byte-identical content one copy over.
 */
const COPIES = 3;

export default function Testimonials() {
  const railRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Array<HTMLElement | null>>([]);
  const cursorRef = useRef(0);

  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const total = items.length;
  const track = useMemo(() => Array.from({ length: COPIES }, () => items).flat(), [total]);

  /**
   * How many cards fit on screen at the current breakpoint. Autoplay needs this
   * to know how far it may travel before wrapping - otherwise it would try to
   * scroll to a position that does not exist.
   */
  const visibleCount = useCallback(() => {
    const rail = railRef.current;
    const first = cardRefs.current[0];
    const second = cardRefs.current[1];
    if (!rail || !first || !second) return 1;
    const step = second.offsetLeft - first.offsetLeft;
    if (step <= 0) return 1;
    return Math.max(1, Math.round(rail.clientWidth / step));
  }, []);

  const scrollToCursor = useCallback(
    (cursor: number, smooth: boolean) => {
      const rail = railRef.current;
      if (!rail) return;
      const clamped = Math.max(0, Math.min(cursor, cardRefs.current.length - 1));
      const target = cardRefs.current[clamped];
      if (!target) return;
      rail.scrollTo({ left: target.offsetLeft, behavior: smooth ? "smooth" : "auto" });
      cursorRef.current = clamped;
      setActive(clamped % total);
    },
    [total],
  );

  const advance = useCallback(
    (direction: 1 | -1) => {
      const last = total * 2 - visibleCount();
      const next = cursorRef.current + direction;
      // Past either end of the middle copy the same review exists one copy
      // over, so jump there without animating - that is what makes the loop
      // seamless instead of sliding back through every card.
      if (direction > 0 && next > last) scrollToCursor(next - total, false);
      else if (direction < 0 && next < 0) scrollToCursor(next + total, false);
      else scrollToCursor(next, true);
    },
    [scrollToCursor, total, visibleCount],
  );

  // Park the rail on the middle copy before first paint, so the visitor never
  // sees the track start on duplicated content.
  useLayoutEffect(() => {
    scrollToCursor(total, false);
  }, [scrollToCursor, total]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener?.("change", sync);
    return () => mq.removeEventListener?.("change", sync);
  }, []);

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const paused = hovered || focused || hidden || reduceMotion;

  useEffect(() => {
    if (paused || total < 2) return;
    const id = window.setInterval(() => advance(1), AUTO_SCROLL_MS);
    return () => window.clearInterval(id);
  }, [paused, total, advance]);

  const arrowClass =
    "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-[var(--color-text)] shadow-[0_8px_20px_rgba(52,78,65,0.10)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(52,78,65,0.16)] dark:border-gray-700 dark:bg-gray-900";

  return (
    <section
      aria-labelledby="testimonials"
      className="text-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      <h2 id="testimonials" className="mb-4 text-3xl font-serif text-[var(--color-text)] md:text-4xl">
        What Our Succulent Plant Customers Say
      </h2>
      <p className="mx-auto mb-8 max-w-2xl text-gray-600 md:mb-10 dark:text-gray-400">
        Join thousands of happy plant lovers
      </p>

      <div className="relative">
        <div
          ref={railRef}
          role="list"
          aria-label="Customer reviews"
          aria-roledescription="carousel"
          // aria-live is off because the rail advances by itself; announcing
          // every automatic slide would talk over the rest of the page.
          aria-live="off"
          className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:gap-6 md:px-0 md:pb-0"
        >
          {track.map((item, index) => {
            const clone = index >= total;
            return (
              <article
                key={`${item.id}-${index}`}
                ref={(el) => {
                  cardRefs.current[index] = el;
                }}
                role={clone ? undefined : "listitem"}
                aria-hidden={clone || undefined}
                // Mobile keeps a peek of the next card as the scroll affordance;
                // md and up show three across, so the rail still has somewhere
                // to travel because the track holds three copies.
                className="testimonial-card w-[85%] max-w-xs flex-none snap-start rounded-2xl border border-gray-100 bg-gradient-to-br from-[var(--color-bg)] to-transparent p-8 text-left shadow-lg md:w-[calc((100%_-_3rem)/3)] md:max-w-none dark:border-gray-700 dark:from-[#0a1420] dark:to-transparent"
              >
                <div className="mb-6 flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <span
                      key={i}
                      className={`text-2xl ${i < item.rating ? "text-yellow-400" : "text-gray-300 dark:text-gray-600"}`}
                    >
                      &#9733;
                    </span>
                  ))}
                </div>
                <blockquote>
                  <p className="mb-6 text-lg italic leading-relaxed text-[var(--color-text)]">{item.quote}</p>
                  <cite className="block text-base font-semibold not-italic text-[var(--color-text)]">
                    - {item.name}
                  </cite>
                </blockquote>
              </article>
            );
          })}
        </div>
      </div>

      {/* Controls live outside the rail so the loop copies never duplicate them
          and the buttons stay out of the scroll area. */}
      <div className="mt-8 flex items-center justify-center gap-4">
        <button type="button" onClick={() => advance(-1)} aria-label="Previous review" className={arrowClass}>
          <ChevronLeft size={18} />
        </button>

        <div className="flex items-center gap-2">
          {items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => scrollToCursor(total + index, true)}
              aria-label={`Show review ${index + 1} of ${total}`}
              aria-current={index === active}
              className={`h-2 rounded-full transition-all ${
                index === active ? "w-6 bg-[var(--color-text)]" : "w-2 bg-gray-300 dark:bg-gray-600"
              }`}
            />
          ))}
        </div>

        <button type="button" onClick={() => advance(1)} aria-label="Next review" className={arrowClass}>
          <ChevronRight size={18} />
        </button>
      </div>
    </section>
  );
}
