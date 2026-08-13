const shimmerSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" preserveAspectRatio="none">
  <defs>
    <linearGradient id="g" x1="0%" x2="100%" y1="0%" y2="0%">
      <stop offset="0%" stop-color="#ebe6de" />
      <stop offset="50%" stop-color="#f7f4ef" />
      <stop offset="100%" stop-color="#ebe6de" />
    </linearGradient>
  </defs>
  <rect width="800" height="600" fill="#e9e3da" />
  <rect id="r" width="800" height="600" fill="url(#g)" />
  <animate xlink:href="#r" attributeName="x" from="-800" to="800" dur="1.2s" repeatCount="indefinite" />
</svg>`;

export const SHIMMER_BLUR_DATA_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(shimmerSvg)}`;
