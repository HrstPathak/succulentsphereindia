/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  compress: true,
  poweredByHeader: false,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    qualities: [60, 70, 75, 80],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Explicit allowlist. A `hostname: '**'` entry (which this file used to
    // have) turns the image optimizer into an open proxy: anyone could pipe
    // arbitrary third-party URLs through your Vercel bandwidth. These entries
    // must stay in sync with OPTIMIZABLE_HOSTS in src/lib/imageUrl.ts.
    remotePatterns: [
      { protocol: 'https', hostname: 'whitesmoke-cattle-754161.hostingersite.com', pathname: '/**' },
      { protocol: 'https', hostname: '*.hostingersite.com', pathname: '/**' },
      { protocol: 'https', hostname: '*.hostinger.com', pathname: '/**' },
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
      { protocol: 'https', hostname: '*.googleusercontent.com', pathname: '/**' },
      { protocol: 'https', hostname: '*.cloudinary.com', pathname: '/**' },
      { protocol: 'https', hostname: '*.amazonaws.com', pathname: '/**' },
      { protocol: 'https', hostname: '*.firebaseio.com', pathname: '/**' },
      { protocol: 'https', hostname: '*.firebasestorage.googleapis.com', pathname: '/**' },
      { protocol: 'https', hostname: '*.googleapis.com', pathname: '/**' },
      { protocol: 'https', hostname: '*.s3.amazonaws.com', pathname: '/**' },
      { protocol: 'https', hostname: '*.blob.core.windows.net', pathname: '/**' },
      { protocol: 'https', hostname: '*.imgix.net', pathname: '/**' },
    ],
    // Product media is content-stable once uploaded, so let the CDN hold it.
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },

  // Add common security headers for all routes
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
        ],
      },

      // ---- Caching: static build output is content-hashed and immutable ----
      // The filename contains a content hash, so changed bytes always mean a
      // changed name. One year is the standard cap for immutable assets.
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/_next/image',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },

      // ---- Media we host ourselves. Filenames are content-derived, so these
      // can be held for a month with a one-day background revalidation. ----
      // NOTE: '/products/:path*' is deliberately absent here. The public folder
      // exposes that same prefix for uploaded product photos, so a rule for the
      // images would collide with the HTML rule for product pages below, and
      // Next.js lets the LAST matching rule win. Uploaded media is served
      // straight from Hostinger in production; these are the legacy local
      // copies, so a shorter cache is a safe compromise.
      ...['/images/:path*', '/assets/:path*',
          '/recovered-product-images/:path*', '/recovered-product-images-2/:path*',
          '/recovered-product-images-2-products/:path*'].map((source) => ({
        source,
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=2592000, stale-while-revalidate=86400' },
        ],
      })),

      // ---- Public read APIs: cache at the CDN, refresh in the background ----
      // Without these, every shop filter/sort/page interaction re-ran the whole
      // Firestore filter pipeline on a cold function. s-maxage absorbs repeats
      // at the edge; stale-while-revalidate keeps p99 flat instead of spiking
      // while a background refresh runs.
      ...[
        ['/api/products', 300, 600],
        ['/api/filters', 1800, 3600],
        ['/api/search', 300, 600],
        ['/api/plant-suggestions', 3600, 86400],
        ['/api/pincode-serviceability', 1800, 3600],
      ].map(([source, sMaxAge, swr]) => ({
        source,
        headers: [
          { key: 'Cache-Control', value: `public, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}` },
        ],
      })),

      // ---- HTML documents: serve from the edge, refresh in the background ----
      // stale-while-revalidate means a product edit is never visible for longer
      // than a single visit, but visitors are never blocked on a cold render.
      ...[
        ['/', 300],
        ['/shop', 300],
        ['/combo', 300],
        ['/combo-builder', 300],
        ['/products/:path*', 300],
        ['/collections/:path*', 300],
        ['/plant-care/:path*', 600],
        ['/about', 600],
        ['/contact', 600],
        ['/sitemap.xml', 3600],
        ['/robots.txt', 3600],
      ].map(([source, sMaxAge]) => ({
        source,
        headers: [
          { key: 'Cache-Control', value: `public, s-maxage=${sMaxAge}, stale-while-revalidate=86400` },
        ],
      })),

      // ---- Never cache personalised or transactional surfaces ----
      // These vary per visitor (session cookie, cart, wallet balance) or are
      // non-idempotent. A shared cache here would leak one customer's data to
      // another, so they are explicitly no-store. Declared last so these rules
      // win over the broad '/(.*)' match above.
      ...[
        '/api/:path*',
        '/account/:path*',
        '/cart',
        '/checkout',
        '/order-placed',
        '/wishlist',
        '/admin/:path*',
        '/login',
        '/signup',
        '/api/checkout',
        '/api/razorpay/:path*',
        '/api/wallet/:path*',
        '/api/customer',
      ].map((source) => ({
        source,
        headers: [
          { key: 'Cache-Control', value: 'private, no-store, max-age=0, must-revalidate' },
        ],
      })),
    ];
  },
};

module.exports = nextConfig;
