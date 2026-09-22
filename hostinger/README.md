# Hostinger media uploads

Blog/product images should live on Hostinger instead of Firestore. The Next.js
app already has the client side (`src/lib/media-upload.ts`) — what's missing is
the server-side upload endpoint, which 404s today (`/uploads` was never
deployed). This folder provides it.

## One-time setup (~2 minutes)

1. Generate the ready-to-deploy endpoint (injects the upload token from
   `.env.local` into a copy that is **not** committed to git):

   ```
   node scripts/build-upload-php.cjs
   ```

   This writes `hostinger/upload.local.php`.

2. Open **hPanel → File Manager** for `whitesmoke-cattle-754161.hostingersite.com`,
   go to `public_html`, and upload `hostinger/upload.local.php` **renamed to
   `upload.php`**.

3. Make sure the environment points at it:

   - Local `.env.local`:
     `HOSTINGER_UPLOAD_URL=https://whitesmoke-cattle-754161.hostingersite.com/upload.php`
   - Vercel (Production + Preview) project environment variables — same values
     for `HOSTINGER_UPLOAD_URL`, `HOSTINGER_UPLOAD_TOKEN`, `NEXT_PUBLIC_MEDIA_BASE_URL`.

   `HOSTINGER_UPLOAD_DIR` is where files land on Hostinger. It is
   `public_html/sites/images` here (your existing image folder); blog media is
   appended as `<dir>/blog` automatically.

4. Verify from the repo root:

   ```
   node scripts/test-hostinger-upload.cjs
   ```

   Expected: `status: 200` and a JSON body containing the new image URL
   (`.../products/blog/test-image.png`).

After this, every Media Library upload (blog covers, inline article images,
product images) is stored on Hostinger under `public_html/sites/images/blog/…`
and served from `https://whitesmoke-cattle-754161.hostingersite.com/sites/images/blog/...`. The
Firestore/Firebase-Storage fallbacks only kick in if the endpoint is
unreachable again.

## Migrating images that were stored inline in Firestore

Images uploaded while the endpoint was broken were saved base64-inside-Firestore
and are served via `/api/media/<id>`. Move them (and rewrite article
references) with:

```
node scripts/migrate-inline-media-to-hostinger.cjs          # dry run — shows the plan
node scripts/migrate-inline-media-to-hostinger.cjs --apply  # upload + rewrite references
```

## Security notes

- `upload.php` requires the shared `UPLOAD_TOKEN` (same value as
  `HOSTINGER_UPLOAD_TOKEN`) on every request — requests without it get 401.
- Only `jpg/jpeg/png/webp/gif/avif` extensions are accepted, and the real
  content type is verified with `finfo` (renamed scripts are rejected).
- Every target directory gets an `.htaccess` that denies PHP execution, so
  nothing stored under `products/…` can ever run as code.
