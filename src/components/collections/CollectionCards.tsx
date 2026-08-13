"use client";

import Image from "next/image";
import Link from "next/link";
import { showSuccessToast } from "../../lib/toast";

type CollectionItem = {
  id: string;
  name: string;
  description: string;
  image: string;
  color: string;
  vibe: string;
  href?: string;
};

export default function CollectionCards({ collections }: { collections: CollectionItem[] }) {
  function handleComingSoonClick() {
    showSuccessToast("Premium collection coming soon. Stay tuned.");
  }

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
      {collections.map((collection, idx) => {
        const isLive =
          collection.id === "succulents" ||
          collection.id === "cacti" ||
          collection.id === "beginner-friendly" ||
          collection.id === "pots";
        const collectionHref = collection.href || `/collections/${collection.id}`;
        const cardClassName =
          "group relative overflow-hidden rounded-2xl border border-black/5 bg-white shadow-[0_14px_28px_rgba(9,20,14,0.12)] transition duration-500 hover:-translate-y-1 hover:shadow-[0_24px_44px_rgba(9,20,14,0.18)] dark:border-white/10 dark:bg-[#0b1722] dark:shadow-[0_14px_28px_rgba(0,0,0,0.5)]";

        const cardBody = (
          <div className="relative h-72 overflow-hidden bg-gray-200">
            <Image
              src={collection.image}
              alt={collection.name}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 20vw"
              className="object-cover transition-transform duration-700 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,11,9,0.14)_0%,rgba(7,11,9,0.34)_48%,rgba(7,11,9,0.78)_100%)]" />
            <div
              className="absolute left-4 top-4 rounded-full border border-white/40 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-white/90 backdrop-blur"
              style={{ backgroundColor: `${collection.color}99` }}
            >
              {collection.vibe}
            </div>
            {!isLive && (
              <div className="absolute right-4 top-4 rounded-full border border-white/40 bg-black/35 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white backdrop-blur">
                Coming Soon
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 p-5">
              <h3 className="text-2xl font-serif text-white">{collection.name}</h3>
              <p className="mt-2 text-sm text-white/90">{collection.description}</p>
              <div className="mt-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-emerald-100 transition group-hover:text-white">
                {isLive ? "Explore collection" : "Coming soon"}
                <span aria-hidden>{isLive ? "->" : "*"}</span>
              </div>
            </div>
          </div>
        );

        if (isLive) {
          return (
            <Link
              key={collection.id}
              href={collectionHref}
              className={cardClassName}
              style={{ transitionDelay: `${idx * 40}ms` }}
            >
              {cardBody}
            </Link>
          );
        }

        return (
          <button
            key={collection.id}
            type="button"
            onClick={handleComingSoonClick}
            className={`${cardClassName} cursor-pointer text-left`}
            style={{ transitionDelay: `${idx * 40}ms` }}
            aria-label={`${collection.name} coming soon`}
          >
            {cardBody}
          </button>
        );
      })}
    </div>
  );
}
