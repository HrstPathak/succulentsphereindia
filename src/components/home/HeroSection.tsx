import Image from "next/image";
import Link from "next/link";
import { SHIMMER_BLUR_DATA_URL } from "@/lib/image-placeholder";
import { mediaAsset } from "@/lib/media";

const heroImage = {
  src: mediaAsset("sites/images/702e1a086c-banner1_60621516-193c-4357-bb45-d7225beca33c.png"),
  alt: "Succulent plant collection for home decor",
};

export default function HeroSection() {
  return (
    <section className="relative w-full h-[50vh] min-h-[500px] overflow-hidden">
      <Image
        src={heroImage.src}
        alt={heroImage.alt}
        fill
        priority
        fetchPriority="high"
        placeholder="blur"
        blurDataURL={SHIMMER_BLUR_DATA_URL}
        quality={80}
        className="object-cover"
        sizes="100vw"
      />

      <div className="absolute inset-0 bg-black/20" />

      <div className="relative z-10 container mx-auto px-4 h-full flex items-center t-35">
        <div className="max-w-2xl text-[var(--color-text)]">
          <h1
            className="text-[40px] md:text-6xl lg:text-7xl font-serif leading-tight mb-6 tracking-tight"
            style={{ textShadow: "0 2px 10px rgba(0,0,0,0.1)" }}
          >
            Elevate Your Space
            <br />
            With Succulent Plants
          </h1>

          <p
            className="text-lg md:text-xl mb-8 max-w-md leading-relaxed text-opacity-90"
            style={{ textShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
          >
            Handpicked premium succulent plants and plant decor for the modern home.
          </p>

          <div className="flex gap-4 flex-wrap">
            <Link
              href="/shop"
              className="bg-[var(--color-brand)] hover:brightness-110 text-white px-8 py-3 rounded-xl shadow-lg hover:shadow-xl font-medium transition-all duration-200 transform hover:scale-105"
            >
              Shop Now
            </Link>

            <Link
              href="/plant-care"
              className="border-2 border-[var(--color-text)] text-[var(--color-text)] px-8 py-3 rounded-xl hover:bg-[var(--color-text)] hover:text-white font-medium transition-all duration-200 backdrop-blur-sm bg-white/10"
            >
              Explore Plant Care
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
