/*
 * Succulent Sphere service worker.
 *
 * Scope is deliberately CONSERVATIVE. Caching HTML documents or any
 * personalised response in a service worker is the classic way to ship a shop
 * that shows one customer another customer's cart, wallet balance or a stale
 * price at checkout. So this worker only ever caches two things:
 *
 *   1. Immutable build output under /_next/static  (content-hashed filenames,
 *      safe to hold forever, and the CDN already serves them).
 *   2. Optimized product images under /_next/image (also content-addressed by
 *      the optimizer's own query params).
 *
 * Everything else - documents, /api/*, /cart, /checkout, /account, /admin -
 * is explicitly excluded and always goes to the network.
 */

const CACHE_VERSION = "ss-static-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;

const PRECACHE_URLS = ["/", "/offline"];

/** Paths that must always hit the network, never the cache. */
const NEVER_CACHE = [
  "/api/",
  "/account",
  "/cart",
  "/checkout",
  "/order-placed",
  "/wishlist",
  "/admin",
  "/login",
  "/signup",
  "/razorpay",
];

/** Only these asset prefixes are eligible for caching. */
function isCacheableAsset(url) {
  if (url.origin !== self.location.origin) return false;
  if (NEVER_CACHE.some((prefix) => url.pathname.startsWith(prefix))) return false;
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/_next/image") ||
    url.pathname.startsWith("/images/") ||
    url.pathname.startsWith("/assets/")
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      // Individually, so one failure does not abort the whole install.
      .then((cache) => Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !key.startsWith(CACHE_VERSION)).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Never intercept anything but safe GETs. POST/PUT/DELETE must reach the
  // server untouched or orders break.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Only immutable assets. Everything else falls through to the default
  // network path, so the app keeps working exactly as it does today if this
  // worker is ever wrong.
  if (!isCacheableAsset(url)) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        // Refresh in the background so the next visit is current.
        event.waitUntil(
          fetch(request)
            .then((response) => {
              if (response && response.ok) return caches.open(STATIC_CACHE).then((c) => c.put(request, response.clone()));
            })
            .catch(() => undefined),
        );
        return cached;
      }

      return fetch(request)
        .then((response) => {
          if (response && response.ok && response.type === "basic") {
            const copy = response.clone();
            event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy)));
          }
          return response;
        })
        .catch(() => caches.match("/offline"));
    }),
  );
});

// Lets the page trigger an immediate update instead of waiting for the
// next natural navigation.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
