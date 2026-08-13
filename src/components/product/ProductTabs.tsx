"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function ProductTabs({ care, description, shipping }: { care: string; description: string; shipping: string }) {
  const tabs = [
    { id: "desc", label: "Description" },
    { id: "care", label: "Care Tips" },
    { id: "ship", label: "Shipping" }
  ];
  const [active, setActive] = useState("desc");
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const plainDescription = description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const shouldShowReadMore = plainDescription.length > 260;

  return (
    <div className="w-full">
      <div className="mb-4 rounded-full dark:border dark:border-white/10 dark:bg-white/5 dark:backdrop-blur-md dark:shadow-[0_12px_28px_rgba(0,0,0,0.35)]">
        <div role="tablist" aria-label="Product tabs" className="flex flex-wrap gap-x-8 gap-y-2 px-2 py-1.5">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={active === t.id}
              aria-controls={`panel-${t.id}`}
              onClick={() => setActive(t.id)}
              className={`pb-2 text-base transition-colors ${
                active === t.id ? "border-b-2 border-[var(--color-brand)] font-semibold text-[var(--color-text)]" : "text-[var(--auth-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="text-[var(--auth-muted)]">
        <AnimatePresence mode="wait">
          {active === "care" && (
            <motion.div key="care" id="panel-care" role="tabpanel" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
              <div className="prose max-w-none whitespace-pre-line text-sm leading-7">{care}</div>
            </motion.div>
          )}
          {active === "desc" && (
            <motion.div key="desc" id="panel-desc" role="tabpanel" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
              <div
                className={`prose max-w-none text-sm leading-7 [&_p]:my-0 [&_ul]:my-1 ${!descriptionExpanded && shouldShowReadMore ? "max-h-[11rem] overflow-hidden" : ""}`}
                dangerouslySetInnerHTML={{ __html: description }}
              />
              {shouldShowReadMore && (
                <button
                  type="button"
                  onClick={() => setDescriptionExpanded((prev) => !prev)}
                  className="mt-2 text-sm font-semibold text-[var(--color-brand)]"
                >
                  {descriptionExpanded ? "Read less" : "Read more"}
                </button>
              )}
            </motion.div>
          )}
          {active === "ship" && (
            <motion.div key="ship" id="panel-ship" role="tabpanel" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
              <div className="prose max-w-none whitespace-pre-line text-sm leading-7">{shipping}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

