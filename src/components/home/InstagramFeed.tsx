"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { mediaAsset } from "@/lib/media";

// Your Hostinger uploads (public_html/sites/images/Insta<N>.webp).
// Served as remote media via MEDIA_BASE_URL — no local copy needed.

const INSTAGRAM_URL = "https://www.instagram.com/succulentsphere/";

// Uploaded via Hostinger File Manager to public_html/sites/images/.
// Case-sensitive on the server: Insta1.webp … Insta5.webp (capital I).
// ~23-58 KiB webp each — fast remote loads, still Next.js-optimized.
const posts = [1, 2, 3, 4, 5].map((n) => ({
  id: n,
  img: mediaAsset(`sites/images/Insta${n}.webp`),
  alt: `Succulent plant inspiration from Instagram post ${n}`,
}));

// Skeleton appears ONLY if the image takes >300ms to load.
// Fast / cached loads render instantly with zero flash (high performance).
function InstaCard({ post, index }: { post: (typeof posts)[number]; index: number }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);

  useEffect(() => {
    if (loaded || failed) {
      setShowSkeleton(false);
      return;
    }
    const t = window.setTimeout(() => setShowSkeleton(true), 300);
    return () => window.clearTimeout(t);
  }, [loaded, failed]);

  const markLoaded = () => {
    setLoaded(true);
    setShowSkeleton(false);
  };
  const markFailed = () => {
    setFailed(true);
    setShowSkeleton(false);
  };

  return (
    <Link
      href={INSTAGRAM_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open Instagram post ${index + 1}`}
      className="group relative aspect-square w-36 flex-shrink-0 snap-start overflow-hidden rounded-2xl bg-[#f3efe7] shadow-sm ring-1 ring-black/5 transition duration-300 hover:-translate-y-1 hover:shadow-xl md:w-44"
    >
      {/* Base + delayed shimmer (only paints when genuinely slow) */}
      {!loaded && !failed && (
        <span
          aria-hidden="true"
          className={
            showSkeleton
              ? "absolute inset-0 animate-pulse bg-gradient-to-r from-[#eee7d8] via-white to-[#eee7d8]"
              : "absolute inset-0 bg-[#f3efe7]"
          }
        />
      )}

      {!failed ? (
        <img
          src={post.img}
          alt={post.alt}
          sizes="(max-width: 640px) 144px, (max-width: 1024px) 176px, 220px"
          loading={index === 0 ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
          onLoad={markLoaded}
          onError={markFailed}
          className={`absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        />
      ) : (
        <span className="absolute inset-0 grid place-items-center bg-gradient-to-br from-[#2e5b3f] to-[#7fb069] text-white">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" stroke="none" /></svg>
        </span>
      )}

      <span className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-black/0 opacity-0 transition duration-300 group-hover:opacity-100" aria-hidden="true" />
      <span className="absolute left-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-white/90 text-[#2e5b3f] opacity-0 shadow transition duration-300 group-hover:opacity-100" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" stroke="none" /></svg>
      </span>
      <span className="absolute inset-x-2 bottom-2 translate-y-2 rounded-full bg-white/95 px-3 py-1 text-center text-[11px] font-semibold text-[#2e5b3f] opacity-0 shadow transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">Shop this look</span>
    </Link>
  );
}

export default function InstagramFeed() {
  return (
    <section aria-labelledby="instagram" className="group/insta relative overflow-hidden rounded-3xl border border-[var(--auth-border)] bg-white/90 shadow-[0_18px_50px_rgba(13,27,21,0.10)] backdrop-blur">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#2e5b3f] via-[#7fb069] to-[#2e5b3f]" aria-hidden="true" />
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-6 md:px-8">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-[#2e5b3f] to-[#7fb069] text-white shadow-md" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" stroke="none" /></svg>
          </span>
          <div className="text-left">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2e5b3f]">Instagram</p>
            <h2 id="instagram" className="font-serif text-xl text-[var(--color-text)] md:text-2xl">
              <Link href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-[#2e5b3f] hover:underline">Follow Succulent Plant Ideas @succulentsphere</Link>
            </h2>
          </div>
        </div>
        <Link href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-[#2e5b3f]/25 bg-[#2e5b3f]/5 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[#2e5b3f] transition hover:-translate-y-0.5 hover:bg-[#2e5b3f] hover:text-white">View profile<span aria-hidden="true">-&gt;</span></Link>
      </div>
      <div className="scrollbar-none -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-6 pt-5 md:gap-4 md:px-8" style={{ scrollbarWidth: "none" }}>
        {posts.map((p, idx) => (
          <InstaCard key={p.id} post={p} index={idx} />
        ))}
      </div>
    </section>
  );
}
