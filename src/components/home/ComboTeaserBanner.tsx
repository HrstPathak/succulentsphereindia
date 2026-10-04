import Image from "next/image";
import Link from "next/link";
import { SHIMMER_BLUR_DATA_URL } from "@/lib/image-placeholder";
import { mediaAsset } from "@/lib/media";
import { shouldBypassImageOptimization } from "@/lib/imageUrl";



const COMBO_BANNER_IMAGE = mediaAsset("sites/images/271c9484fa-Combo_Builder.png");

/**
 * Decorative plant glyphs for the "Pick any 4" orbs.
 *
 * These are hand-drawn inline SVG rather than lucide-react icons: the pinned
 * version (0.408) has no succulent or cactus glyph - its closest options are
 * `Sprout`/`Leaf`, which read as generic seedlings rather than the rosettes and
 * spiky archetypes this shop actually sells. Stroke-based to match lucide's
 * line style, so they sit on the cream orb gradient without looking pasted on.
 */

function RosetteGlyph() {
  // Echeveria-style top view: two offset rings of petals around a centre pip.
  return (
    <>
      {[...Array(8)].map((_, i) => (
        <ellipse key={`outer-${i}`} cx="12" cy="7.4" rx="2.6" ry="4.6" transform={`rotate(${45 * i} 12 12)`} />
      ))}
      {[...Array(6)].map((_, i) => (
        <ellipse key={`inner-${i}`} cx="12" cy="9" rx="2.1" ry="3" transform={`rotate(${60 * i + 24} 12 12)`} />
      ))}
      <circle cx="12" cy="12" r="1.35" fill="currentColor" stroke="none" />
    </>
  );
}

function AgaveGlyph() {
  // Aloe/agave: sharp upright spikes fanning out from a shared base.
  return (
    <>
      {[...Array(7)].map((_, i) => (
        <path key={i} d="M10.7 3.8 L12 12.2 L13.3 3.8" transform={`rotate(${(360 / 7) * i} 12 12)`} />
      ))}
    </>
  );
}

function BarrelGlyph() {
  // Barrel cactus: ribbed body with spines radiating the whole way round. The
  // full ring of spines is what stops it reading as a plain striped ball.
  const cx = 12;
  const cy = 12.6;
  const rx = 6.2;
  const ry = 6.8;
  const spine = 8.5;

  // Radial spines, one every 30 degrees.
  const spines = [...Array(12)].map((_, i) => {
    const a = (Math.PI * 2 * i) / 12;
    const [cos, sin] = [Math.cos(a), Math.sin(a)];
    return `M${(cx + ry * cos).toFixed(2)} ${(cy + ry * sin).toFixed(2)}L${(cx + spine * cos).toFixed(2)} ${(cy + spine * sin).toFixed(2)}`;
  });

  // Ribs bowed outward, each trimmed to land exactly on the body ellipse.
  const ribs = [...Array(5)].map((_, i) => {
    const x = 7.8 + i * 2.1;
    const half = ry * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2));
    const bow = x < cx ? -0.7 : x > cx ? 0.7 : 0;
    return `M${x} ${(cy - half).toFixed(2)}Q${(x + bow).toFixed(2)} ${cy} ${x} ${(cy + half).toFixed(2)}`;
  });

  return (
    <>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} />
      <path d={ribs.join("")} />
      <path d={spines.join("")} />
    </>
  );
}

const PEARLS = [
  [5.4, 7.2],
  [7.6, 9.8],
  [10.4, 11.9],
  [13.6, 12.7],
  [16.8, 12],
  [19.4, 9.9],
];

function PearlsGlyph() {
  // String of pearls: a trailing stem with beads that shrink toward the tip.
  return (
    <>
      <path d="M5.4 7.2 L7.6 9.8 L10.4 11.9 L13.6 12.7 L16.8 12 L19.4 9.9" />
      {PEARLS.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={1.95 - i * 0.12} fill="currentColor" stroke="none" />
      ))}
    </>
  );
}

const GLYPHS = [RosetteGlyph, AgaveGlyph, BarrelGlyph, PearlsGlyph];

function SucculentGlyph({ index, className }: { index: number; className?: string }) {
  const Glyph = GLYPHS[index % GLYPHS.length];
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <Glyph />
    </svg>
  );
}

export default function ComboTeaserBanner() {
  return (
    <div className="relative overflow-hidden rounded-[36px] border border-white/80 bg-[radial-gradient(120%_120%_at_10%_0%,#fff8ef_0%,#f6f1e6_42%,#e8efe8_100%)] px-6 py-12 text-[#2a2f2b] shadow-[0_30px_70px_rgba(35,40,34,0.18)] md:px-12 lg:px-16">
      <div className="pointer-events-none absolute inset-0 opacity-95">
        <Image
          src={COMBO_BANNER_IMAGE}
          alt=""
          unoptimized={shouldBypassImageOptimization(COMBO_BANNER_IMAGE)}
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

        <div className="mt-8 w-full rounded-[28px] border border-white/85 bg-white/[0.88] p-6 shadow-[0_20px_46px_rgba(13,27,21,0.18)] backdrop-blur">
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.32em] text-emerald-800">Pick any 4</div>
          <div className="mx-auto flex items-center justify-center gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`combo-circle-${index}`}
                className="combo-pick-orb grid h-14 w-14 place-items-center rounded-full border border-white/95 bg-[radial-gradient(circle_at_35%_30%,#ffffff,#f1e7d9_55%,#e2d6c6_100%)] shadow-[0_10px_20px_rgba(15,24,20,0.16)]"
                style={{ animationDelay: `${index * 160}ms` }}
              >
                <SucculentGlyph index={index} className="h-7 w-7 text-emerald-800" />
              </div>
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
