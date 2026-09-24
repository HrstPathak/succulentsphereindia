import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { SHIMMER_BLUR_DATA_URL } from "@/lib/image-placeholder";
import { mediaAsset } from "@/lib/media";
import { shouldBypassImageOptimization } from "@/lib/imageUrl";

const heroImage = {
  src: mediaAsset("sites/images/HomePage/AfterMonsoonHero.webp"),
  alt: "Sunlit succulent in a stone pot against misty monsoon hills",
};

export default function HeroSection() {
  return (
    <section className="ss-hero relative flex w-full min-h-[520px] items-center overflow-hidden sm:min-h-[560px] lg:min-h-[640px]">
      <Image
        src={heroImage.src}
        alt={heroImage.alt}
        unoptimized={shouldBypassImageOptimization(heroImage.src)}
        fill
        priority
        fetchPriority="high"
        placeholder="blur"
        blurDataURL={SHIMMER_BLUR_DATA_URL}
        quality={80}
        /* Narrow screens crop the 16:9 source hard; biasing the crop right keeps
           the potted succulent in frame instead of slicing it off. */
        className="object-cover object-[72%_50%] sm:object-center"
        sizes="100vw"
      />

      {/* Warm haze veil. The old flat `bg-black/20` scrim only greyed out a photo
          that is already sunlit; this keeps the left copy legible while leaving
          the succulent and the light crisp. Kept deliberately light so the photo
          still reads — legibility is carried by the text shadows below. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,247,236,0.76)_0%,rgba(255,246,234,0.52)_32%,rgba(255,244,230,0.16)_56%,rgba(255,244,230,0)_78%)]"
      />

      <div className="container relative z-10 mx-auto flex h-full items-center px-4">
        <div className="max-w-xl text-[#1f2a1c]">
          <h1
            className="mb-5 font-serif text-[38px] leading-[1.06] tracking-tight text-[#1b2418] sm:text-[46px] md:text-[58px] lg:text-[66px]"
            style={{
              textShadow:
                "0 1px 2px rgba(255,255,255,0.55), 0 2px 16px rgba(255,255,255,0.40)",
            }}
          >
            After Monsoon,
            <br />
            It&rsquo;s the Perfect Time
            <br />
            for Succulents
          </h1>

          <p
            className="mb-8 max-w-md text-base leading-relaxed text-[#33402d] sm:text-lg"
            style={{ textShadow: "0 1px 2px rgba(255,255,255,0.65)" }}
          >
            Cooler days, healthier plants, and the best time to grow your succulent
            collection.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/shop"
              className="group inline-flex items-center gap-2 rounded-full bg-[#2f4a3a] px-7 py-3.5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(23,35,20,0.28)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#263d30] hover:shadow-[0_16px_34px_rgba(23,35,20,0.34)] sm:text-base"
            >
              Shop Now
              <ArrowRight
                size={18}
                className="transition-transform duration-200 group-hover:translate-x-1"
                aria-hidden="true"
              />
            </Link>

            <Link
              href="/plant-care"
              className="inline-flex items-center rounded-full border border-[#2f4a3a]/40 bg-white/55 px-7 py-3.5 text-sm font-semibold text-[#1f2a1c] backdrop-blur-sm transition duration-200 hover:border-[#2f4a3a]/70 hover:bg-white/80 sm:text-base"
            >
              Explore Plant Care
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
