"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { FirebaseAuthenticatedCustomer } from "@/lib/commerce";

export type CustomerSessionStatus = "loading" | "authenticated" | "anonymous";

export type CustomerSessionSnapshot = {
  customer: FirebaseAuthenticatedCustomer | null;
  status: CustomerSessionStatus;
  isAdmin: boolean;
};

type CustomerSessionContextValue = CustomerSessionSnapshot & {
  refresh: () => Promise<CustomerSessionSnapshot>;
  setCustomer: (customer: FirebaseAuthenticatedCustomer | null, isAdmin?: boolean) => void;
};

const anonymousSnapshot: CustomerSessionSnapshot = {
  customer: null,
  status: "anonymous",
  isAdmin: false,
};

const CustomerSessionContext = createContext<CustomerSessionContextValue | null>(null);
const STALE_AFTER_MS = 5 * 60 * 1000;

export function CustomerSessionProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<CustomerSessionSnapshot>({
    ...anonymousSnapshot,
    status: "loading",
  });
  const requestRef = useRef<Promise<CustomerSessionSnapshot> | null>(null);
  const sessionRevisionRef = useRef(0);
  const lastFetchedAtRef = useRef(0);

  const refresh = useCallback((): Promise<CustomerSessionSnapshot> => {
    if (requestRef.current) return requestRef.current;

    const revision = sessionRevisionRef.current;
    const request = (async () => {
      let nextSnapshot = anonymousSnapshot;
      try {
        const response = await fetch("/api/customer", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Unable to load customer session.");

        const payload = await response.json();
        if (payload?.authenticated && payload?.customer) {
          nextSnapshot = {
            customer: payload.customer as FirebaseAuthenticatedCustomer,
            status: "authenticated",
            isAdmin: Boolean(payload.isAdmin),
          };
        }
      } catch {
        nextSnapshot = anonymousSnapshot;
      }

      lastFetchedAtRef.current = Date.now();
      if (revision === sessionRevisionRef.current) setSnapshot(nextSnapshot);
      return revision === sessionRevisionRef.current ? nextSnapshot : anonymousSnapshot;
    })();

    requestRef.current = request;
    void request.finally(() => {
      if (requestRef.current === request) requestRef.current = null;
    });
    return request;
  }, []);

  const setCustomer = useCallback(
    (customer: FirebaseAuthenticatedCustomer | null, isAdmin?: boolean) => {
      sessionRevisionRef.current += 1;
      lastFetchedAtRef.current = Date.now();
      setSnapshot((current) => ({
        customer,
        status: customer ? "authenticated" : "anonymous",
        isAdmin: customer ? (isAdmin ?? current.isAdmin) : false,
      }));
    },
    [],
  );

  const refreshAfterAuthChange = useCallback(() => {
    const pendingRequest = requestRef.current;
    if (pendingRequest) {
      void pendingRequest.finally(() => {
        void refresh();
      });
      return;
    }
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void refresh();

    const onAuthChanged = () => refreshAfterAuthChange();
    window.addEventListener("auth:changed", onAuthChanged);

    let hiddenAt = document.visibilityState === "hidden" ? Date.now() : null;
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }

      if (hiddenAt !== null && Date.now() - hiddenAt >= STALE_AFTER_MS) {
        void refresh();
      }
      hiddenAt = null;
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("auth:changed", onAuthChanged);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refresh, refreshAfterAuthChange]);

  return (
    <CustomerSessionContext.Provider value={{ ...snapshot, refresh, setCustomer }}>
      {children}
    </CustomerSessionContext.Provider>
  );
}

export function useCustomerSession() {
  const context = useContext(CustomerSessionContext);
  if (!context) throw new Error("useCustomerSession must be used within CustomerSessionProvider.");
  return context;
}
