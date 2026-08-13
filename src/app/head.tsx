import { MEDIA_BASE_URL } from "@/lib/media";

export default function Head() {
  return (
    <>
      <link rel="dns-prefetch" href={MEDIA_BASE_URL} />
      <link rel="preconnect" href={MEDIA_BASE_URL} crossOrigin="" />
    </>
  );
}
