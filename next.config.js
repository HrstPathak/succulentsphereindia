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
    qualities: [75, 80],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      { protocol: 'http', hostname: '**', pathname: '/**' },
      { protocol: 'https', hostname: '**', pathname: '/**' },
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
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
