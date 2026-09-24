import Image from "next/image";
import Link from "next/link";
import { SHIMMER_BLUR_DATA_URL } from "@/lib/image-placeholder";
import { mediaAsset } from "@/lib/media";
import { shouldBypassImageOptimization } from "@/lib/imageUrl";

const posts = [1, 2, 3, 4, 5, 6, 7].map((n) => ({
  id: n,
  img: mediaAsset("sites/images/Insta" + n + ".webp"),
  alt: "Succulent plant inspiration from Instagram post " + n,
}));

export default function InstagramFeed() {
  return (
    <section aria-labelledby="instagram" className="">
      <h2 id="instagram" className="text-lg font-serif mb-4 text-center">
        <Link
          href="https://www.instagram.com/succulentsphere/"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          Follow Succulent Plant Ideas{" "}
          <span className="font-semibold italic text-[#2e5b3f]"> @succulentsphere</span>
        </Link>
      </h2>
      <div className="flex gap-4 px-4 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {posts.map((p) => (
          <div key={p.id} className="w-36 h-36 flex-shrink-0 rounded overflow-hidden bg-white shadow-sm">
            <Image
              src={p.img}
              alt={p.alt}
              unoptimized={shouldBypassImageOptimization(p.img)}
              width={144}
              height={144}
              style={{ objectFit: "cover" }}
              loading="lazy"
              placeholder="blur"
              blurDataURL={SHIMMER_BLUR_DATA_URL}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
