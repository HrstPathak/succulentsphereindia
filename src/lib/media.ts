// Static marketing assets are served independently of the Next.js deployment.
// Set NEXT_PUBLIC_MEDIA_BASE_URL in each deployment environment when the
// temporary Hostinger hostname is replaced by the permanent media subdomain.
export const MEDIA_BASE_URL = (
  process.env.NEXT_PUBLIC_MEDIA_BASE_URL ||
  "https://whitesmoke-cattle-754161.hostingersite.com"
).replace(/\/+$/, "");

export function mediaAsset(relativePath: string): string {
  return `${MEDIA_BASE_URL}/${relativePath.replace(/^\/+/, "")}`;
}
