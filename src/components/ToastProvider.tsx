"use client";

import { useEffect, useState } from "react";

type AppToast = {
  id: number;
  message: string;
  type: "success" | "error";
};

export default function ToastProvider() {
  const [toasts, setToasts] = useState<AppToast[]>([]);

  useEffect(() => {
    const onToast = (event: Event) => {
      const customEvent = event as CustomEvent<{ message?: string; type?: "success" | "error" }>;
      const message = customEvent.detail?.message?.trim();
      const type = customEvent.detail?.type || "success";
      if (!message) return;

      const id = Date.now() + Math.floor(Math.random() * 1000);
      setToasts((prev) => [...prev, { id, message, type }]);

      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 2500);
    };

    window.addEventListener("app-toast", onToast);
    return () => {
      window.removeEventListener("app-toast", onToast);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed right-4 z-[1000] flex flex-col gap-2 pointer-events-none"
      style={{ top: "calc(var(--ss-header-offset, 64px) + 8px)" }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto rounded-xl border px-4 py-2 text-sm text-white shadow-lg backdrop-blur-md ${
            toast.type === "error"
              ? "border-red-400/40 bg-red-500/90"
              : "border-emerald-300/40 bg-emerald-600/90"
          }`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
