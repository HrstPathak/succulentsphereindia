import Image from "next/image";
import Link from "next/link";
import { SHIMMER_BLUR_DATA_URL } from "@/lib/image-placeholder";
import { mediaAsset } from "@/lib/media";

export default function ComboTeaserBanner() {
  return (
    <div className="relative overflow-hidden rounded-[36px] border border-white/80 bg-[radial-gradient(120%_120%_at_10%_0%,#fff8ef_0%,#f6f1e6_42%,#e8efe8_100%)] px-6 py-12 text-[#2a2f2b] shadow-[0_30px_70px_rgba(35,40,34,0.18)] md:px-12 lg:px-16">
      <div className="pointer-events-none absolute inset-0 opacity-95">
        <Image
          src={mediaAsset("sites/images/271c9484fa-Combo_Builder.png")}
          alt=""
          fill
          sizes="100vw"
          loading="lazy"
          placeholder="blur"
          blurDataURL={SHIMMER_BLUR_DATA_URL}
          className="object-cover"
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_10%,rgba(255,255,255,0.7),rgba(255,255,255,0)_40%)]" />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_60%_18%,rgba(255,255,255,0.55),rgba(255,255,255,0)_50%),linear-gradient(180deg,rgba(255,252,248,0.55)_0%,rgba(245,241,232,0.5)_45%,rgba(232,239,232,0.6)_100%)]" />
      <div className="pointer-events-none absolute -left-24 top-10 h-52 w-52 rounded-full bg-[radial-gradient(circle,rgba(191,205,169,0.3),transparent_72%)]" />
      <div className="pointer-events-none absolute -right-28 -top-20 h-60 w-60 rounded-full bg-[radial-gradient(circle,rgba(214,170,144,0.22),transparent_70%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_25%,rgba(255,255,255,0.35),transparent_40%),radial-gradient(circle_at_80%_35%,rgba(255,255,255,0.28),transparent_45%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:radial-gradient(circle,rgba(255,255,255,0.9)_1px,transparent_1px)] [background-size:22px_22px] [background-position:0_0]" />
      <div className="pointer-events-none absolute inset-0 border border-white/60" />

      <div className="relative mx-auto flex max-w-2xl flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/90 bg-white/90 px-6 py-2 text-[11px] font-semibold uppercase tracking-[0.45em] text-emerald-800 shadow-[0_10px_24px_rgba(16,90,54,0.12)]">
          Custom Combo Builder
        </div>
        <h3 className="mt-6 text-[34px] font-serif tracking-tight leading-tight text-[#3e3a35] md:text-5xl">
          Mix &amp; Match 4 Plants, Save 10%
        </h3>
        <p className="mt-3 max-w-xl text-sm text-emerald-900/70 md:text-base">
          Build your own custom combo box -- handpicked from 60+ varieties
        </p>
        <Link
          href="/combo-builder"
          className="mt-8 inline-flex items-center justify-center rounded-full bg-[linear-gradient(180deg,#3e5b48_0%,#2f4d3f_100%)] px-8 py-3 text-sm font-semibold text-white shadow-[0_18px_32px_rgba(16,90,54,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_40px_rgba(16,90,54,0.45)]"
        >
          Build Your Combo
        </Link>

        <div className="mt-8 w-full rounded-[28px] border border-white/85 bg-white/88 p-6 shadow-[0_20px_46px_rgba(13,27,21,0.18)] backdrop-blur">
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.32em] text-emerald-800">Pick any 4</div>
          <div className="mx-auto flex items-center justify-center gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`combo-circle-${index}`}
                className="combo-pick-orb h-14 w-14 rounded-full border border-white/95 bg-[radial-gradient(circle_at_35%_30%,#ffffff,#f1e7d9_55%,#e2d6c6_100%)] shadow-[0_10px_20px_rgba(15,24,20,0.16)]"
                style={{ animationDelay: `${index * 160}ms` }}
              />
            ))}
          </div>
          <div className="mt-4 text-xs text-emerald-900/60">Curated, packed, and delivered with care.</div>
          <div className="mx-auto mt-4 w-fit rounded-full border border-white/80 bg-white/90 px-5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.4em] text-emerald-800 shadow-[0_10px_20px_rgba(16,90,54,0.12)]">
            Limited slots daily
          </div>
        </div>
      </div>
    </div>
  );
}
