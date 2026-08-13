"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";

type DeferredMarketingScriptsProps = {
  gtmId?: string;
  facebookPixelId?: string;
};

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: typeof window.fbq;
    dataLayer: Array<Record<string, unknown>>;
    __ssMarketingScriptsLoaded?: boolean;
  }
}

const INTERACTION_EVENTS: Array<keyof WindowEventMap> = [
  "scroll",
  "click",
  "mousemove",
  "touchstart",
];

export default function DeferredMarketingScripts({
  gtmId,
  facebookPixelId,
}: DeferredMarketingScriptsProps) {
  const [hasInteracted, setHasInteracted] = useState(false);
  const [pixelReady, setPixelReady] = useState(false);
  const pathname = usePathname();
  const lastTrackedPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.__ssMarketingScriptsLoaded) {
      setHasInteracted(true);
      return;
    }

    const enableScripts = () => {
      window.__ssMarketingScriptsLoaded = true;
      setHasInteracted(true);
    };

    for (const eventName of INTERACTION_EVENTS) {
      window.addEventListener(eventName, enableScripts, { passive: true, once: true });
    }

    return () => {
      for (const eventName of INTERACTION_EVENTS) {
        window.removeEventListener(eventName, enableScripts);
      }
    };
  }, []);

  useEffect(() => {
    if (!facebookPixelId || !pixelReady || typeof window === "undefined") return;
    const currentPath = `${pathname}${window.location.search || ""}`;
    if (lastTrackedPathRef.current === currentPath) return;

    window.fbq?.("track", "PageView");
    lastTrackedPathRef.current = currentPath;
  }, [facebookPixelId, pathname, pixelReady]);

  if (!hasInteracted) {
    return null;
  }

  return (
    <>
      {gtmId ? (
        <>
          <Script id="gtm-bootstrap" strategy="lazyOnload">
            {`window.dataLayer = window.dataLayer || [];
if (!window.dataLayer.some(function(entry){ return entry && entry.event === 'gtm.js'; })) {
  window.dataLayer.push({'gtm.start': Date.now(), event: 'gtm.js'});
}`}
          </Script>
          <Script
            id="gtm-script"
            src={`https://www.googletagmanager.com/gtm.js?id=${gtmId}`}
            strategy="lazyOnload"
          />
        </>
      ) : null}

      {facebookPixelId ? (
        <>
          <Script id="fb-pixel-bootstrap" strategy="lazyOnload">
            {`if (!window.fbq) {
  !function(f,b,e,n)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[]}(window, document,'script');
  fbq('init', '${facebookPixelId}');
}`}
          </Script>
          <Script
            id="fb-pixel-script"
            src="https://connect.facebook.net/en_US/fbevents.js"
            strategy="lazyOnload"
            onLoad={() => {
              setPixelReady(true);
            }}
          />
        </>
      ) : null}
    </>
  );
}
