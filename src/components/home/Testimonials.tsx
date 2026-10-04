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

export default function Testimonials() {
  return (
    <section aria-labelledby="testimonials" className="text-center">
      <h2 id="testimonials" className="mb-4 text-3xl font-serif text-[var(--color-text)] md:text-4xl">
        What Our Succulent Plant Customers Say
      </h2>
      <p className="mx-auto mb-12 max-w-2xl text-gray-600 dark:text-gray-400">
        Join thousands of happy plant lovers
      </p>

      {/*
        Mobile: a snap-scrolling horizontal rail so the three reviews sit side by
        side instead of stacking into a very tall column. `scrollbar-none` (see
        globals.css) keeps the scrollbar invisible while the swipe stays native.
        md and up: the original three-column grid is restored and every rail-only
        utility is reset, so desktop layout is byte-for-byte unchanged.
      */}
      <div
        role="list"
        aria-label="Customer reviews"
        className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:px-0 md:pb-0 md:snap-none"
      >
        {items.map((item) => (
          <article
            key={item.id}
            role="listitem"
            // Sized so the next review peeks in, which is what signals to the
            // visitor that the row scrolls. Reset on md, where the grid owns sizing.
            className="testimonial-card w-[85%] max-w-xs flex-none snap-start rounded-2xl border border-gray-100 bg-gradient-to-br from-[var(--color-bg)] to-transparent p-8 text-left shadow-lg md:w-auto md:max-w-none dark:border-gray-700 dark:from-[#0a1420] dark:to-transparent"
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
              <cite className="block text-base font-semibold not-italic text-[var(--color-text)]">- {item.name}</cite>
            </blockquote>
          </article>
        ))}
      </div>
    </section>
  );
}
