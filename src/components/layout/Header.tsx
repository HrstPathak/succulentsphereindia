"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import CartCountBadge from "./CartCountBadge";
import SearchBar from "../ui/SearchBar";
import MobileDrawer from "./MobileDrawer";
import DarkModeToggle from "../ui/DarkModeToggle";
import WishlistCounter from "../wishlist/WishlistCounter";
import { AlignLeft, CircleUserRound, Heart, LogOut, Search, ShieldCheck, ShoppingCart, User, X } from "lucide-react";

type HeaderCustomer = {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  email?: string;
};

function getCustomerInitial(customer: HeaderCustomer | null): string | null {
  if (!customer) return null;
  const first = customer.firstName?.trim() || "";
  const last = customer.lastName?.trim() || "";
  if (first && last) return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
  if (first) return first.charAt(0).toUpperCase();
  if (last) return last.charAt(0).toUpperCase();

  const display = customer.displayName?.trim() || "";
  if (display) {
    const parts = display.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
    return parts[0].charAt(0).toUpperCase();
  }

  const email = customer.email?.trim() || "";
  return email ? email.charAt(0).toUpperCase() : null;
}

export default function Header() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [infoIndex, setInfoIndex] = useState(0);
  const [customerInitial, setCustomerInitial] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const infoMessages = [
    "Unboxing video is mandatory for any refund or return claim.",
    "Plants are generally delivered bare-root unless mentioned otherwise.",
    "Pots shown in images are for catalog display/reference only."
  ];
  const pathParts = (pathname || "").split("/").filter(Boolean);
  const isCollectionListingPage = pathParts.length === 2 && pathParts[0] === "collections";
  const isCollectionProductDetailPage = pathParts.length === 3 && pathParts[0] === "collections";
  const isProductDetailPage = pathParts.length === 2 && pathParts[0] === "products";
  const isShopPage = pathParts.length === 1 && pathParts[0] === "shop";
  const isComboPage = pathParts.length === 1 && (pathParts[0] === "combo" || pathParts[0] === "combo-builder");
  const showShoppingNotice =
    isCollectionListingPage || isCollectionProductDetailPage || isProductDetailPage || isShopPage || isComboPage;
  const noticeBarHeight = showShoppingNotice ? 36 : 0;
  const navHeight = 64;
  const headerOffset = noticeBarHeight + navHeight;

  const loadCustomer = useCallback(async () => {
    try {
      const response = await fetch("/api/customer", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) {
        setCustomerInitial(null);
        setIsAdmin(false);
        return;
      }
      const json = await response.json();
      setCustomerInitial(getCustomerInitial(json?.customer || null));
      setIsAdmin(Boolean(json?.isAdmin));
    } catch {
      setCustomerInitial(null);
      setIsAdmin(false);
    }
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--ss-header-offset", `${headerOffset}px`);
    return () => {
      document.documentElement.style.setProperty("--ss-header-offset", "64px");
    };
  }, [headerOffset]);

  useEffect(() => {
    if (!showShoppingNotice) return;
    const timer = setInterval(() => {
      setInfoIndex((prev) => (prev + 1) % infoMessages.length);
    }, 3300);
    return () => clearInterval(timer);
  }, [infoMessages.length, showShoppingNotice]);

  useEffect(() => {
    loadCustomer();
  }, [loadCustomer, pathname]);

  useEffect(() => {
    const onAuthChanged = () => {
      loadCustomer();
    };
    window.addEventListener("auth:changed", onAuthChanged);
    return () => window.removeEventListener("auth:changed", onAuthChanged);
  }, [loadCustomer]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target?.closest("[data-account-menu='true']")) {
        setAccountMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  useEffect(() => {
    setAccountMenuOpen(false);
  }, [pathname]);

  async function handleLogout() {
    try {
      const response = await fetch("/api/logout", { method: "POST" });
      if (!response.ok) return;
      setCustomerInitial(null);
      setIsAdmin(false);
      setAccountMenuOpen(false);
      window.dispatchEvent(new Event("auth:changed"));
      router.replace("/login");
      router.refresh();
    } catch {
      // no-op
    }
  }

  const accountTrigger = customerInitial ? (
    <span
      className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--auth-border)] bg-white/85 text-[12px] font-semibold text-[var(--color-brand)] shadow-sm"
      aria-hidden="true"
    >
      {customerInitial}
    </span>
  ) : (
    <User size={20} strokeWidth={1.9} />
  );
  const useDesktopGlassIcons = !scrolled && !showShoppingNotice;
  const desktopUtilityShellClass = useDesktopGlassIcons
    ? "h-12 rounded-2xl border border-white/60 bg-white/60 p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.14)] backdrop-blur-md"
    : "h-12 rounded-2xl border border-transparent bg-transparent p-1.5 shadow-none";
  const desktopUtilityButtonClass = "relative rounded-xl p-2 text-[var(--color-text)] transition hover:bg-black/5";

  // The private admin dashboard has its own header and sidebar navigation.
  // Rendering the storefront header here overlays those controls.
  if (pathname?.startsWith("/admin")) return null;

  return (
    <header
      className={`fixed w-full top-0 z-50 transition-colors duration-300 ${
        scrolled || showShoppingNotice ? "bg-white/95 shadow-sm backdrop-blur" : "bg-transparent"
      }`}
      role="banner"
    >
      {showShoppingNotice && (
        <div className="border-b border-white/25 bg-[linear-gradient(90deg,#1d4a39_0%,#56744f_42%,#b48760_100%)] px-4 py-2 text-white">
          <div className="container mx-auto flex justify-center md:justify-start">
            <div className="min-w-0 max-w-3xl flex-1 text-center md:max-w-4xl md:text-left">
              <div className="inline-flex max-w-full items-center justify-center gap-2 md:justify-start">
                <span className="hidden text-[11px] font-semibold tracking-[0.14em] text-white/95 md:inline">
                  SHOPPING NOTICE
                </span>
                <p className="text-[11px] leading-4 text-white/95 transition-opacity duration-300 md:truncate md:text-[12px] md:leading-5">
                  {infoMessages[infoIndex]}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="w-full px-4 py-4 flex items-center justify-between md:px-6 lg:px-8" style={{ height: 64 }}>
        <div className="hidden md:flex items-center gap-2">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="p-2"
          >
            <AlignLeft size={20} strokeWidth={1.9} />
          </button>
          <Link href="/" aria-label="Succulent Sphere home" className="flex items-center">
            <span className="text-lg font-serif text-[var(--color-text)]">Succulent Sphere</span>
          </Link>
        </div>

        <nav aria-label="Primary" className="hidden md:flex gap-6 text-sm items-center">
          {[
            { href: "/shop", label: "Shop" },
            { href: "/order-tracker", label: "Track Order", className: "hidden lg:inline-flex" },
            { href: "/collections", label: "Collections" },
            { href: "/plant-care", label: "Plant Care", className: "hidden xl:inline-flex" },
            { href: "/contact#contact", label: "Contact", className: "hidden xl:inline-flex" }
          ].map((item) => {
            const active = pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group inline-flex flex-col items-center gap-1 px-1 py-2 transition-transform transform hover:-translate-y-0.5 focus:-translate-y-0.5 ${item.className ?? ""}`}
                aria-current={active ? "page" : undefined}
              >
                <span className={`text-sm inline-flex items-center gap-1.5 ${active ? "font-semibold text-[var(--color-brand)]" : "text-[var(--color-text)] hover:text-[var(--color-accent)]"}`}>
                  {item.label}
                </span>
                <span
                  className={`block h-0.5 bg-[var(--color-brand)] transition-all duration-300 ${active ? "w-full" : "w-0 group-hover:w-full"}`}
                  aria-hidden="true"
                />
              </Link>
            );
          })}
        </nav>

        {/* Desktop nav and search */}
        <div className="hidden md:flex items-center gap-4">
          <div className="hidden lg:block w-80">
            <SearchBar />
          </div>
          <div className={`ml-4 flex items-center gap-1 ${desktopUtilityShellClass}`}>
            <button
              type="button"
              onClick={() => setMobileSearchOpen(true)}
              aria-label="Open search"
              className={`md:inline-flex lg:hidden ${desktopUtilityButtonClass}`}
            >
              <Search size={20} strokeWidth={1.9} />
            </button>
            <Link href="/cart" className={desktopUtilityButtonClass} aria-label="Open cart">
              <ShoppingCart size={20} strokeWidth={1.9} />
              <CartCountBadge />
            </Link>
            <Link href="/wishlist" className={desktopUtilityButtonClass} aria-label="Open wishlist">
              <Heart size={20} strokeWidth={1.9} />
              <WishlistCounter />
            </Link>
            {customerInitial ? (
              <div className="relative" data-account-menu="true">
                <button
                  type="button"
                  onClick={() => setAccountMenuOpen((prev) => !prev)}
                  className={desktopUtilityButtonClass}
                  aria-label="Account menu"
                  aria-expanded={accountMenuOpen}
                >
                  {accountTrigger}
                </button>
                {accountMenuOpen && (
                  <div className="absolute right-0 top-12 z-[80] min-w-[170px] rounded-xl border border-gray-200 bg-white p-2 shadow-xl">
                    <Link
                      href="/account"
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-gray-50"
                      onClick={() => setAccountMenuOpen(false)}
                    >
                      <CircleUserRound size={16} />
                      Profile
                    </Link>
                    {isAdmin ? (
                      <Link
                        href="/admin"
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[var(--color-brand)] hover:bg-gray-50"
                        onClick={() => setAccountMenuOpen(false)}
                      >
                        <ShieldCheck size={16} />
                        Admin
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-[#800020] hover:bg-gray-50"
                      onClick={handleLogout}
                    >
                      <LogOut size={16} />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link href="/account" className={desktopUtilityButtonClass} aria-label="Account">
                {accountTrigger}
              </Link>
            )}
            <DarkModeToggle className="border-transparent bg-transparent hover:bg-black/5 dark:border-transparent dark:bg-transparent dark:hover:bg-white/10" />
          </div>
        </div>

        {/* Mobile header layout */}
        <div className="flex md:hidden items-center w-full justify-between ">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              className="p-2"
              style={{ padding: 8 }}
            >
              <AlignLeft size={21} strokeWidth={1.9} />
            </button>
            <button
              onClick={() => setMobileSearchOpen(true)}
              aria-label="Open search"
              className="p-2"
              style={{ padding: 8 }}
            >
              <Search size={21} strokeWidth={1.9} />
            </button>
          </div>

          <div className="text-center flex-1">
            <Link href="/" className="text-lg font-serif" style={{ letterSpacing: "0.6px" }}>
              Succulent Sphere
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/cart" className="relative p-2" aria-label="Open cart">
              <ShoppingCart size={20} strokeWidth={1.9} />
              <CartCountBadge />
            </Link>
            {customerInitial ? (
              <div className="relative" data-account-menu="true">
                <button
                  type="button"
                  onClick={() => setAccountMenuOpen((prev) => !prev)}
                  className="p-2"
                  aria-label="Account menu"
                  aria-expanded={accountMenuOpen}
                >
                  {accountTrigger}
                </button>
                {accountMenuOpen && (
                  <div className="absolute right-0 top-12 z-[80] min-w-[170px] rounded-xl border border-gray-200 bg-white p-2 shadow-xl">
                    <Link
                      href="/account"
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-gray-50"
                      onClick={() => setAccountMenuOpen(false)}
                    >
                      <CircleUserRound size={16} />
                      Profile
                    </Link>
                    <Link
                      href="/wishlist"
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-gray-50"
                      onClick={() => setAccountMenuOpen(false)}
                    >
                      <Heart size={16} />
                      Wishlist
                      <span className="ml-auto">
                        <WishlistCounter inline className="min-w-5 px-1.5 py-0.5" />
                      </span>
                    </Link>
                    {isAdmin ? (
                      <Link
                        href="/admin"
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[var(--color-brand)] hover:bg-gray-50"
                        onClick={() => setAccountMenuOpen(false)}
                      >
                        <ShieldCheck size={16} />
                        Admin
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-[#800020] hover:bg-gray-50"
                      onClick={handleLogout}
                    >
                      <LogOut size={16} />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link href="/account" className="p-2" aria-label="Account">
                {accountTrigger}
              </Link>
            )}
          </div>
        </div>
        {/* Desktop end */}
        <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
        {/* Mobile search panel */}
        {mobileSearchOpen && (
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileSearchOpen(false)} />
            <div className="absolute top-0 left-0 right-0 bg-white dark:bg-[#071018] p-4 transform transition-transform duration-300" style={{ transform: "translateY(0)" }}>
              <div className="flex-1 flex items-center gap-2">
                <div className="flex-1">
                  <SearchBar />
                </div>
                <button className="p-2 flex-shrink-0" aria-label="Close search" onClick={() => setMobileSearchOpen(false)}>
                  <X size={22} strokeWidth={2} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
