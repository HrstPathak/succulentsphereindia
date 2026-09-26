"use client";

import { useEffect } from "react";

/**
 * Registers the static-asset service worker (public/sw.js).
 *
 * Registration is deferred until after load so it never competes with the
 * initial render, and is skipped in development where a stale worker would
 * mask code changes. The worker itself only caches immutable assets, so
 * registering it cannot serve stale HTML, prices or account data.
 */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Registration failure is non-fatal; the site works without it.
      });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
