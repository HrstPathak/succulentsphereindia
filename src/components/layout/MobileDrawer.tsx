"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import DarkModeToggle from "../ui/DarkModeToggle";
import { AtSign, ChevronDown, ChevronRight, Facebook, FileText, Grid3X3, House, Info, Instagram, Mail, MessageCircle, Package, Phone, ShoppingBag, Sprout } from "lucide-react";

export default function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    if (!open) setCollectionsOpen(false);
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const collectionLinks = useMemo(
    () => [
      { href: "/collections/succulents", label: "Succulent Collection" },
      { href: "/collections/cactus", label: "Cactus Collection" },
      { href: "/combo", label: "Combo Collection" },
      { href: "/combo-builder", label: "Combo Builder" },
      { href: "/collections/beginner-friendly", label: "Beginner Friendly Collection" },
      { href: "/collections/pots", label: "Pots Collection" },
    ],
    []
  );

  const navItems = useMemo(
    () => [
      { href: "/", label: "Home", icon: House },
      { href: "/shop", label: "Shop", icon: ShoppingBag },
      { href: "/collections", label: "Collections", icon: Grid3X3 },
      { href: "/plant-care", label: "Plant Care", icon: Sprout },
      { href: "/order-tracker", label: "Track Order", icon: Package },
      { href: "/policies", label: "Policies", icon: FileText },
      { href: "/about", label: "About Us", icon: Info },
      { href: "/contact", label: "Contact", icon: MessageCircle },
    ],
    []
  );

  if (!mounted) return null;

  return createPortal(
    <>
      <div
        className={`fixed inset-0 z-[2147483646] backdrop-blur-[2px] transition-[opacity,backdrop-filter] duration-300 ease-out ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none backdrop-blur-none"}`}
        aria-hidden={!open}
        onClick={onClose}
        style={{ background: "rgba(0,0,0,0.4)" }}
      />

      <aside
        className={`fixed top-0 left-0 z-[2147483647] isolate h-full w-72 max-w-[88vw] overflow-y-auto bg-white dark:bg-[#071018] shadow-2xl will-change-transform [transition:transform_420ms_cubic-bezier(0.22,1,0.36,1),opacity_320ms_ease] ${open ? "translate-x-0 opacity-100" : "-translate-x-[102%] opacity-0 pointer-events-none"}`}
        role="dialog"
        aria-modal="true"
      >
        <div className={`relative h-full p-4 pb-44 transition-all duration-300 ease-out ${open ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}>
          <nav className="flex flex-col">
            {navItems.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href || pathname?.startsWith(`${item.href}/`);
              if (item.href === "/collections") {
                return (
                  <div key={item.href} className="border-b border-gray-100 dark:border-gray-700">
                    <button
                      type="button"
                      onClick={() => setCollectionsOpen((prev) => !prev)}
                      aria-expanded={collectionsOpen}
                      className={`group relative flex w-full items-center gap-3 py-4 text-lg transition-all ${
                        active
                          ? "text-[var(--color-brand)] dark:text-emerald-300"
                          : "text-gray-900 dark:text-gray-100"
                      }`}
                    >
                      {active && <span className="absolute left-0 top-3 bottom-3 w-1 rounded-full bg-[linear-gradient(180deg,#2f5f4a_0%,#7aa67f_100%)]" />}
                      <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-all ${
                        active
                          ? "border-[#cdbba2] bg-[linear-gradient(145deg,#fff6e8_0%,#eef5e9_100%)] shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/40"
                          : "border-gray-200 dark:border-gray-700"
                      }`}>
                        <item.icon size={17} strokeWidth={2} className="opacity-90" />
                      </span>
                      <span className="flex-1 text-left font-medium">{item.label}</span>
                      <ChevronDown
                        size={18}
                        strokeWidth={2}
                        className={`transition-transform ${collectionsOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                    <div
                      className={`overflow-hidden transition-[max-height,opacity] duration-300 ${
                        collectionsOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                      }`}
                    >
                      <div className="mb-3 rounded-xl border border-gray-200 bg-white/70 p-3 dark:border-gray-700 dark:bg-white/5">
                        <div className="space-y-1">
                          {collectionLinks.map((collection) => (
                            <Link
                              key={collection.href}
                              href={collection.href}
                              onClick={onClose}
                              className="group flex items-center justify-between px-1 py-2 text-sm text-gray-800 transition hover:text-[var(--color-brand)] dark:text-gray-200 dark:hover:text-emerald-200"
                            >
                              <span className="font-medium">{collection.label}</span>
                              <ChevronRight size={16} className="text-[var(--auth-muted)] transition group-hover:text-[var(--color-brand)] dark:group-hover:text-emerald-200" />
                            </Link>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  aria-current={active ? "page" : undefined}
                  className={`group relative flex items-center gap-3 py-4 text-lg border-b dark:border-gray-700 transition-all ${
                    active
                      ? "border-[#d8c8b2] text-[var(--color-brand)] dark:border-emerald-900/60 dark:text-emerald-300"
                      : "border-gray-100 text-gray-900 dark:text-gray-100"
                  }`}
                >
                  {active && <span className="absolute left-0 top-3 bottom-3 w-1 rounded-full bg-[linear-gradient(180deg,#2f5f4a_0%,#7aa67f_100%)]" />}
                  <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-all ${
                    active
                      ? "border-[#cdbba2] bg-[linear-gradient(145deg,#fff6e8_0%,#eef5e9_100%)] shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/40"
                      : "border-gray-200 dark:border-gray-700"
                  }`}>
                    <item.icon size={17} strokeWidth={2} className="opacity-90" />
                  </span>
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="absolute left-4 right-4 bottom-4 pt-5 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-[#071018]">
            <div className="mb-4">
              <DarkModeToggle variant="inline" />
            </div>

            <div className="flex flex-col gap-2 text-sm text-gray-700 dark:text-gray-300">
              <a href="tel:+919458321209" className="inline-flex items-center gap-2 hover:text-[var(--color-brand)] transition-colors">
                <Phone size={15} />
                +91 94583 21209
              </a>
              <a href="mailto:support@succulentsphere.com" className="inline-flex items-center gap-2 hover:text-[var(--color-brand)] transition-colors break-all">
                <Mail size={15} />
                support@succulentsphere.com
              </a>
            </div>

            <div className="mt-4 flex items-center gap-3 text-gray-800 dark:text-gray-100">
              <a
                href="https://www.instagram.com/succulentsphere/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="p-2 rounded-full border border-gray-200 dark:border-gray-600 hover:text-[var(--color-brand)] hover:border-[var(--color-brand)] transition-colors"
              >
                <Instagram size={18} strokeWidth={1.8} />
              </a>
              <a
                href="https://www.facebook.com/profile.php?id=61586867373040"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="p-2 rounded-full border border-gray-200 dark:border-gray-600 hover:text-[var(--color-brand)] hover:border-[var(--color-brand)] transition-colors"
              >
                <Facebook size={18} strokeWidth={1.8} />
              </a>
              <a
                href="https://wa.me/919458321209?text=Hi%20Succulent%20Sphere,%20I%20need%20help%20regarding%20your%20plants."
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                className="p-2 rounded-full border border-gray-200 dark:border-gray-600 hover:text-[var(--color-brand)] hover:border-[var(--color-brand)] transition-colors"
              >
                <MessageCircle size={18} strokeWidth={1.8} />
              </a>
              <a
                href="https://www.threads.net/@succulentsphere"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Threads"
                className="p-2 rounded-full border border-gray-200 dark:border-gray-600 hover:text-[var(--color-brand)] hover:border-[var(--color-brand)] transition-colors"
              >
                <AtSign size={18} strokeWidth={1.8} />
              </a>
            </div>
          </div>
        </div>
      </aside>
    </>,
    document.body
  );
}
