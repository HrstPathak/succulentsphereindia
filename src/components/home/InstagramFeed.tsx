import Image from "next/image";
import Link from "next/link";
import { SHIMMER_BLUR_DATA_URL } from "@/lib/image-placeholder";

const posts = Array.from({ length: 6 }).map((_, i) => ({
  id: i,
  img: `/assets/ig-${i + 1}.jpg`,
  alt: `Succulent plant inspiration from Instagram post ${i + 1}`
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
          Follow Succulent Plant Ideas @succulentsphere
        </Link>
      </h2>
      <div className="flex gap-4 px-4 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {posts.map((p) => (
          <div key={p.id} className="w-36 h-36 flex-shrink-0 rounded overflow-hidden bg-white shadow-sm">
            <Image
              src={p.img}
              alt={p.alt}
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
