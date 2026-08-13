"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Heart,
  Leaf,
  MapPin,
  Package,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Truck,
} from "lucide-react";
import Button from "./Button";
import Input from "./Input";
import OrdersListClient from "./OrdersListClient";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import type { FirebaseAuthenticatedCustomer, FirebaseCustomerAddress } from "@/lib/commerce";

type AccountDashboardProps = {
  customer: FirebaseAuthenticatedCustomer;
  isGoogleLogin?: boolean;
  isAdmin?: boolean;
};

type SectionKey = "orders" | "addresses" | "settings" | null;

type AddressDraft = {
  id?: string;
  firstName: string;
  lastName: string;
  company: string;
  address1: string;
  address2: string;
  city: string;
  province: string;
  country: string;
  zip: string;
  phone: string;
};

const INDIA_STATE_OPTIONS = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
] as const;

function normalizeIndianPhone(value: string) {
  const digits = value.replace(/\D/g, "").replace(/^91/, "");
  return digits ? `+91${digits.slice(0, 10)}` : "";
}

function phoneDigitsWithoutCountry(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("91") ? digits.slice(2, 12) : digits.slice(0, 10);
}

function formatOrderDate(value: string) {
  if (!value) return "N/A";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));
}

function formatOrderTotal(amount: string, currencyCode: string) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return `${currencyCode} ${amount}`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode }).format(value);
}

function passwordStrength(password: string) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  if (score <= 1) return { score, label: "Weak", color: "bg-red-500" };
  if (score === 2) return { score, label: "Fair", color: "bg-amber-500" };
  if (score === 3) return { score, label: "Strong", color: "bg-[var(--color-secondary)]" };
  return { score, label: "Excellent", color: "bg-[var(--color-brand)]" };
}

function toAddressDraft(address?: FirebaseCustomerAddress): AddressDraft {
  return {
    id: address?.id,
    firstName: address?.firstName || "",
    lastName: address?.lastName || "",
    company: address?.company || "",
    address1: address?.address1 || "",
    address2: address?.address2 || "",
    city: address?.city || "",
    province: address?.province || "",
    country: address?.country || "India",
    zip: address?.zip || "",
    phone: normalizeIndianPhone(address?.phone || ""),
  };
}

function formatMemberSince(orders: FirebaseAuthenticatedCustomer["orders"]) {
  if (orders.length === 0) return "Member since this year";
  const oldestOrder = [...orders].sort((a, b) => new Date(a.processedAt).getTime() - new Date(b.processedAt).getTime())[0];
  if (!oldestOrder?.processedAt) return "Member since this year";
  return `Member since ${new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(new Date(oldestOrder.processedAt))}`;
}

function AccountMenuItem({
  label,
  meta,
  expanded,
  onClick,
  icon,
}: {
  label: string;
  meta?: string;
  expanded?: boolean;
  onClick: () => void;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-all ${
        expanded
          ? "border-[var(--color-brand)]/45 bg-[var(--color-secondary)]/18 shadow-[0_8px_18px_rgba(52,78,65,0.12)]"
          : "border-[var(--auth-border)] bg-white/55 hover:border-[var(--color-brand)]/35 hover:bg-white/75"
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="text-[var(--color-brand)]">{icon}</span>
        <span className="text-xl font-medium text-[var(--color-text)]">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {meta ? <span className="text-sm text-[var(--auth-muted)]">{meta}</span> : null}
        {expanded ? (
          <ChevronDown size={18} className="text-[var(--auth-muted)]" />
        ) : (
          <ChevronRight size={18} className="text-[var(--auth-muted)] transition-transform group-hover:translate-x-0.5" />
        )}
      </div>
    </button>
  );
}

export default function AccountDashboard({ customer, isGoogleLogin = false, isAdmin = false }: AccountDashboardProps) {
  const router = useRouter();
  const [data, setData] = useState(customer);
  const [expandedSection, setExpandedSection] = useState<SectionKey>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [refreshingOrders, setRefreshingOrders] = useState(false);
  const [profileDraft, setProfileDraft] = useState({
    firstName: customer.firstName || "",
    lastName: customer.lastName || "",
    phone: customer.phone || "",
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [passwordDraft, setPasswordDraft] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [addressSaving, setAddressSaving] = useState(false);
  const [deleteAddressId, setDeleteAddressId] = useState<string | null>(null);
  const [deletingAddress, setDeletingAddress] = useState(false);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);
  const [addressDraft, setAddressDraft] = useState<AddressDraft>(toAddressDraft());
  
  // Check if profile is incomplete (missing firstName or lastName)
  const isProfileIncomplete = !customer.firstName?.trim() || !customer.lastName?.trim();

  // Auto-open profile modal for Google login users with incomplete profile
  useEffect(() => {
    if (isGoogleLogin && isProfileIncomplete) {
      openProfileModal();
    }
  }, [isGoogleLogin, isProfileIncomplete]);

  const fullName = [data.firstName, data.lastName].filter(Boolean).join(" ") || data.displayName || "Customer";
  const initials =
    fullName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "C";
  const memberSince = formatMemberSince(data.orders);
  const recentOrders = data.orders.slice(0, 2);
  const ordersMeta = `${data.orders.length} recent ${data.orders.length === 1 ? "order" : "orders"}`;
  const addressesMeta = `${data.addresses.length} saved ${data.addresses.length === 1 ? "address" : "addresses"}`;

  const strength = useMemo(() => passwordStrength(passwordDraft.newPassword), [passwordDraft.newPassword]);

  const refreshCustomerData = useCallback(
    async (showLoader = false) => {
      if (showLoader) setRefreshingOrders(true);
      try {
        const response = await fetch("/api/customer", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });
        const json = await response.json();
        if (!response.ok) {
          if (response.status === 401) {
            showErrorToast(String(json?.error || "Session expired. Please login again."));
            router.replace("/login");
            return;
          }
          throw new Error(String(json?.error || "Unable to refresh account details."));
        }
        if (json?.customer) setData(json.customer);
      } catch (error) {
        if (showLoader) showErrorToast((error as Error).message || "Unable to refresh orders.");
      } finally {
        if (showLoader) setRefreshingOrders(false);
      }
    },
    [router]
  );

  useEffect(() => {
    if (expandedSection !== "orders") return;
    refreshCustomerData(false);
    const timer = setInterval(() => {
      refreshCustomerData(false);
    }, 30000);
    return () => clearInterval(timer);
  }, [expandedSection, refreshCustomerData]);

  function toggleSection(section: Exclude<SectionKey, null>) {
    setExpandedSection((prev) => (prev === section ? null : section));
  }

  function openProfileModal() {
    setProfileDraft({
      firstName: data.firstName || "",
      lastName: data.lastName || "",
      phone: data.phone || "",
    });
    setProfileModalOpen(true);
  }

  async function handleLogout() {
    try {
      const response = await fetch("/api/logout", { method: "POST" });
      if (!response.ok) {
        const json = await response.json();
        showErrorToast(String(json?.error || "Logout failed."));
        return;
      }
      showSuccessToast("You are logged out.");
      router.replace("/login");
      router.refresh();
    } catch (error) {
      showErrorToast((error as Error).message || "Unable to logout.");
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const firstName = profileDraft.firstName.trim();
    const lastName = profileDraft.lastName.trim();
    const phone = profileDraft.phone.trim();
    if (!firstName || !lastName) {
      showErrorToast("First name and last name are required.");
      return;
    }
    if (phone && !/^[+\d\s\-()]{7,20}$/.test(phone)) {
      showErrorToast("Please enter a valid phone number.");
      return;
    }

    setSavingProfile(true);
    try {
      const response = await fetch("/api/account/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, phone }),
      });
      const json = await response.json();
      if (!response.ok) {
        showErrorToast(String(json?.error || "Unable to update profile."));
        if (response.status === 401) router.replace("/login");
        return;
      }
      if (json?.customer) setData(json.customer);
      showSuccessToast("Profile updated.");
      setProfileModalOpen(false);
      router.refresh();
    } catch (error) {
      showErrorToast((error as Error).message || "Unable to update profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const currentPassword = passwordDraft.currentPassword;
    const newPassword = passwordDraft.newPassword;
    const confirmPassword = passwordDraft.confirmPassword;
    if (!currentPassword) return showErrorToast("Current password is required.");
    if (newPassword.length < 8) return showErrorToast("New password must be at least 8 characters.");
    if (newPassword !== confirmPassword) return showErrorToast("New password and confirm password must match.");

    setUpdatingPassword(true);
    try {
      const response = await fetch("/api/account/update-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const json = await response.json();
      if (!response.ok) {
        showErrorToast(String(json?.error || "Unable to update password."));
        if (response.status === 401) router.replace("/login");
        return;
      }
      setPasswordDraft({ currentPassword: "", newPassword: "", confirmPassword: "" });
      showSuccessToast("Password updated successfully.");
      router.refresh();
    } catch (error) {
      showErrorToast((error as Error).message || "Unable to update password.");
    } finally {
      setUpdatingPassword(false);
    }
  }

  function openAddAddress() {
    setAddressDraft(toAddressDraft());
    setAddressModalOpen(true);
  }

  function openEditAddress(address: FirebaseCustomerAddress) {
    setAddressDraft(toAddressDraft(address));
    setAddressModalOpen(true);
  }

  async function saveAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedPhone = normalizeIndianPhone(addressDraft.phone);
    const normalizedZip = addressDraft.zip.replace(/\D/g, "").slice(0, 6);

    if (!addressDraft.address1.trim() || !addressDraft.city.trim() || !addressDraft.country.trim() || !addressDraft.zip.trim()) {
      showErrorToast("Address line 1, city, country, and zip are required.");
      return;
    }
    if (!addressDraft.province.trim()) {
      showErrorToast("Please select a state.");
      return;
    }
    if (!/^\d{6}$/.test(normalizedZip)) {
      showErrorToast("Please enter a valid 6-digit PIN code.");
      return;
    }
    if (normalizedPhone && !/^\+91\d{10}$/.test(normalizedPhone)) {
      showErrorToast("Please enter a valid 10-digit mobile number.");
      return;
    }

    const payload = {
      ...addressDraft,
      country: "India",
      zip: normalizedZip,
      phone: normalizedPhone,
    };

    const endpoint = addressDraft.id ? "/api/account/update-address" : "/api/account/add-address";
    setAddressSaving(true);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok) {
        showErrorToast(String(json?.error || "Unable to save address."));
        if (response.status === 401) router.replace("/login");
        return;
      }
      if (json?.customer) {
        setData(json.customer);
      } else {
        await refreshCustomerData(false);
      }
      setAddressModalOpen(false);
      showSuccessToast(addressDraft.id ? "Address updated." : "Address added.");
      router.refresh();
    } catch (error) {
      showErrorToast((error as Error).message || "Unable to save address.");
    } finally {
      setAddressSaving(false);
    }
  }

  async function removeAddress() {
    if (!deleteAddressId) return;
    setDeletingAddress(true);
    try {
      const response = await fetch("/api/account/delete-address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteAddressId }),
      });
      const json = await response.json();
      if (!response.ok) {
        showErrorToast(String(json?.error || "Unable to delete address."));
        if (response.status === 401) router.replace("/login");
        return;
      }
      if (json?.customer) setData(json.customer);
      setDeleteAddressId(null);
      showSuccessToast("Address removed.");
      router.refresh();
    } catch (error) {
      showErrorToast((error as Error).message || "Unable to delete address.");
    } finally {
      setDeletingAddress(false);
    }
  }

  async function setDefaultAddress(addressId: string) {
    setSettingDefaultId(addressId);
    try {
      const response = await fetch("/api/account/set-default-address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addressId }),
      });
      const json = await response.json();
      if (!response.ok) {
        showErrorToast(String(json?.error || "Unable to set default address."));
        if (response.status === 401) router.replace("/login");
        return;
      }
      if (json?.customer) setData(json.customer);
      showSuccessToast("Default address updated.");
      router.refresh();
    } catch (error) {
      showErrorToast((error as Error).message || "Unable to set default address.");
    } finally {
      setSettingDefaultId(null);
    }
  }

  return (
    <section
      className="auth-shell-bg min-h-screen bg-[var(--color-bg)] px-4 pb-16 pt-8"
      style={{ paddingTop: "calc(var(--ss-header-offset, 64px) + 24px)" }}
    >
      <div className="mx-auto max-w-5xl">
        <div className="rounded-[30px] border border-[var(--auth-border)] bg-[linear-gradient(155deg,#f7f3ef_0%,#f2ece6_55%,#efe7df_100%)] p-4 shadow-[0_20px_55px_rgba(12,20,14,0.16)] sm:p-6">
          <div className="rounded-2xl bg-[radial-gradient(circle_at_85%_35%,rgba(120,145,118,0.2),transparent_34%),linear-gradient(160deg,rgba(255,255,255,0.7),rgba(255,255,255,0.25))] px-4 py-5 sm:px-6">
            <div className="flex items-start justify-between gap-3">
              <h1 className="font-serif text-4xl text-[var(--color-text)]">My Account</h1>
              <Link
                href="/shop"
                aria-label="Go to shop"
                className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--auth-border)] bg-white/70 text-[var(--color-text)] transition-colors hover:border-[var(--color-brand)]/45 hover:text-[var(--color-brand)]"
              >
                <ShoppingBag size={18} strokeWidth={1.8} />
              </Link>
            </div>
            <p className="mt-2 text-2xl text-[var(--color-text)]/90">Welcome back, {data.firstName || "Customer"}.</p>
            <p className="mt-2 max-w-xl text-base text-[var(--auth-muted)]">Manage your orders, addresses and plant care preferences.</p>
          </div>

          <div className="mt-4 rounded-2xl border border-[var(--auth-border)] bg-white/62 p-4 shadow-[0_12px_30px_rgba(0,0,0,0.08)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-16 w-16 place-items-center rounded-full border border-white/70 bg-[linear-gradient(145deg,#ece3d8_0%,#ccb59a_100%)] text-lg font-semibold text-[var(--color-brand)] shadow-inner">
                  {initials}
                </div>
                <div className="overflow-hidden truncate">
                  <p className="font-serif text-3xl text-[var(--color-text)]">{fullName}</p>
                  <p className="text-sm text-[var(--auth-muted)]">{data.email}</p>
                  <p className="mt-1 text-xs text-[var(--auth-muted)]">{memberSince}</p>
                </div>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                {isAdmin ? (
                  <Link
                    href="/admin"
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--color-brand)]/35 bg-white/80 px-4 py-2.5 text-sm font-semibold text-[var(--color-brand)] transition-colors hover:bg-[var(--color-secondary)]/20"
                  >
                    <ShieldCheck size={17} />
                    Admin dashboard
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={openProfileModal}
                  className="w-full rounded-lg bg-[var(--color-brand)] px-6 py-2.5 text-sm font-semibold text-[var(--color-bg)] shadow-[0_8px_18px_rgba(52,78,65,0.2)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(52,78,65,0.25)]"
                >
                  Edit Profile
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-2.5">
            <AccountMenuItem
              label="Orders"
              meta={ordersMeta}
              expanded={expandedSection === "orders"}
              onClick={() => toggleSection("orders")}
              icon={<Package size={20} strokeWidth={1.8} />}
            />
            {expandedSection === "orders" && (
              <div className="rounded-xl border border-[var(--auth-border)] bg-white/70 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-[var(--color-text)]">Recent 2 Orders</p>
                  <button
                    type="button"
                    onClick={() => refreshCustomerData(true)}
                    disabled={refreshingOrders}
                    className="rounded-lg border border-[var(--color-brand)]/30 px-2.5 py-1 text-xs font-semibold text-[var(--color-brand)] disabled:opacity-60"
                  >
                    {refreshingOrders ? "Refreshing..." : "Refresh"}
                  </button>
                </div>
                {recentOrders.length === 0 ? (
                  <p className="text-sm text-[var(--auth-muted)]">No orders yet.</p>
                ) : (
                  <OrdersListClient orders={recentOrders} className="mt-0" />
                )}
                <div className="mt-3">
                  <Link
                    href="/account/orders"
                    className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-brand)] px-3 py-1.5 text-sm font-semibold text-[var(--color-bg)]"
                  >
                    All Orders
                    <ChevronRight size={15} />
                  </Link>
                </div>
              </div>
            )}

            <AccountMenuItem
              label="Wishlist"
              meta="Saved plants"
              onClick={() => router.push("/wishlist")}
              icon={<Heart size={20} strokeWidth={1.8} />}
            />

            <AccountMenuItem
              label="Addresses"
              meta={addressesMeta}
              expanded={expandedSection === "addresses"}
              onClick={() => toggleSection("addresses")}
              icon={<MapPin size={20} strokeWidth={1.8} />}
            />
            {expandedSection === "addresses" && (
              <div className="rounded-xl border border-[var(--auth-border)] bg-white/70 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[var(--color-text)]">Saved Addresses</p>
                  <button
                    type="button"
                    onClick={openAddAddress}
                    className="rounded-lg bg-[var(--color-brand)] px-3 py-1.5 text-xs font-semibold text-[var(--color-bg)]"
                  >
                    Add Address
                  </button>
                </div>
                {data.addresses.length === 0 ? (
                  <p className="text-sm text-[var(--auth-muted)]">No addresses saved yet.</p>
                ) : (
                  <div className="space-y-3">
                    {data.addresses.map((address) => {
                      const isDefault = data.defaultAddressId === address.id;
                      return (
                        <div key={address.id} className="rounded-xl border border-[var(--auth-border)] bg-white/80 p-3">
                          <div className="mb-1 flex items-center justify-between">
                            <p className="text-sm font-semibold text-[var(--color-text)]">
                              {[address.firstName, address.lastName].filter(Boolean).join(" ") || "Address"}
                            </p>
                            {isDefault ? (
                              <span className="rounded-full bg-[var(--color-secondary)]/30 px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--color-brand)]">
                                Default
                              </span>
                            ) : null}
                          </div>
                          <p className="text-xs text-[var(--auth-muted)]">
                            {[address.address1, address.address2, address.city, address.province, address.country, address.zip].filter(Boolean).join(", ")}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => openEditAddress(address)}
                              className="rounded-lg border border-[var(--color-secondary)]/35 px-2.5 py-1 text-xs font-semibold text-[var(--color-text)]"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteAddressId(address.id)}
                              className="rounded-lg border px-2.5 py-1 text-xs font-semibold"
                              style={{ borderColor: "var(--auth-danger-border)", color: "var(--auth-danger-text)" }}
                            >
                              Delete
                            </button>
                            {!isDefault ? (
                              <button
                                type="button"
                                disabled={settingDefaultId === address.id}
                                onClick={() => setDefaultAddress(address.id)}
                                className="rounded-lg border border-[var(--color-brand)]/35 px-2.5 py-1 text-xs font-semibold text-[var(--color-brand)] disabled:opacity-60"
                              >
                                {settingDefaultId === address.id ? "Saving..." : "Set Default"}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <AccountMenuItem
              label="Care Reminders"
              meta="Coming soon"
              onClick={() => showSuccessToast("Care reminders are coming soon.")}
              icon={<Leaf size={20} strokeWidth={1.8} />}
            />

            <AccountMenuItem
              label="Settings"
              meta="Security"
              expanded={expandedSection === "settings"}
              onClick={() => toggleSection("settings")}
              icon={<Settings size={20} strokeWidth={1.8} />}
            />
            {expandedSection === "settings" && (
              <div className="rounded-xl border border-[var(--auth-border)] bg-white/70 p-4">
                <form onSubmit={savePassword} className="space-y-3">
                  <h3 className="font-serif text-2xl text-[var(--color-text)]">Change Password</h3>
                  <Input
                    label="Current Password"
                    type="password"
                    value={passwordDraft.currentPassword}
                    onChange={(event) => setPasswordDraft((prev) => ({ ...prev, currentPassword: event.target.value }))}
                  />
                  <Input
                    label="New Password"
                    type="password"
                    value={passwordDraft.newPassword}
                    onChange={(event) => setPasswordDraft((prev) => ({ ...prev, newPassword: event.target.value }))}
                  />
                  <div className="rounded-xl border p-3" style={{ borderColor: "var(--auth-border)", backgroundColor: "var(--auth-surface)" }}>
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="text-[var(--auth-muted)]">Password strength</span>
                      <span className="font-semibold text-[var(--color-text)]">{strength.label}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {[0, 1, 2, 3].map((index) => (
                        <div key={index} className={`h-1.5 rounded-full ${index < strength.score ? strength.color : "bg-[var(--color-secondary)]/25"}`} />
                      ))}
                    </div>
                  </div>
                  <Input
                    label="Confirm New Password"
                    type="password"
                    value={passwordDraft.confirmPassword}
                    onChange={(event) => setPasswordDraft((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                  />
                  <Button type="submit" loading={updatingPassword}>
                    Update Password
                  </Button>
                </form>
              </div>
            )}
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3 rounded-xl border border-[var(--auth-border)] bg-white/45 px-3 py-3 text-sm text-[var(--auth-muted)]">
            <div className="flex items-center justify-center gap-1.5">
              <Truck size={14} />
              <span>Safe Shipping</span>
            </div>
            <div className="flex items-center justify-center gap-1.5">
              <ShieldCheck size={14} />
              <span>Healthy Guarantee</span>
            </div>
            <div className="flex items-center justify-center gap-1.5">
              <Leaf size={14} />
              <span>Plant Support</span>
            </div>
          </div>
        </div>
      </div>

      {profileModalOpen && (
        <div className="fixed inset-0 z-[88] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => !savingProfile && setProfileModalOpen(false)} />
          <div
            className="relative z-[89] w-full max-w-2xl rounded-2xl border p-5 shadow-[0_24px_70px_rgba(0,0,0,0.34)] backdrop-blur-xl"
            style={{ borderColor: "var(--auth-border)", backgroundColor: "var(--auth-surface-strong)" }}
          >
            <h3 className="font-serif text-2xl text-[var(--color-text)]">Edit Profile</h3>
            <form onSubmit={saveProfile} className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="First Name"
                  value={profileDraft.firstName}
                  onChange={(event) => setProfileDraft((prev) => ({ ...prev, firstName: event.target.value }))}
                />
                <Input
                  label="Last Name"
                  value={profileDraft.lastName}
                  onChange={(event) => setProfileDraft((prev) => ({ ...prev, lastName: event.target.value }))}
                />
              </div>
              <Input label="Email" value={data.email} readOnly disabled />
              <Input
                label="Phone"
                value={profileDraft.phone}
                onChange={(event) => setProfileDraft((prev) => ({ ...prev, phone: event.target.value }))}
              />
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={savingProfile}
                  onClick={() => setProfileModalOpen(false)}
                  className="rounded-xl border border-[var(--color-secondary)]/35 px-4 py-2 text-sm font-semibold text-[var(--color-text)] hover:bg-[var(--color-secondary)]/20 disabled:opacity-60"
                >
                  Cancel
                </button>
                <Button type="submit" loading={savingProfile} className="w-auto px-5">
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {addressModalOpen && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center p-2 sm:items-center sm:p-4">
          <div className="absolute inset-0 bg-black/25 backdrop-blur-sm" onClick={() => !addressSaving && setAddressModalOpen(false)} />
          <div
            className="relative z-[91] w-full max-w-2xl max-h-[calc(100dvh-0.75rem)] overflow-hidden rounded-2xl border p-4 shadow-[0_24px_70px_rgba(0,0,0,0.34)] backdrop-blur-xl sm:max-h-[calc(100dvh-2rem)] sm:p-5"
            style={{ borderColor: "var(--auth-border)", backgroundColor: "var(--auth-surface-strong)" }}
          >
            <h3 className="font-serif text-2xl text-[var(--color-text)]">{addressDraft.id ? "Edit Address" : "Add Address"}</h3>
            <form onSubmit={saveAddress} className="hide-scrollbar mt-4 max-h-[calc(100dvh-8.5rem)] space-y-3 overflow-y-auto pr-1 sm:max-h-[calc(100dvh-11rem)] sm:pr-2">
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="First Name" value={addressDraft.firstName} onChange={(e) => setAddressDraft((p) => ({ ...p, firstName: e.target.value }))} />
                <Input label="Last Name" value={addressDraft.lastName} onChange={(e) => setAddressDraft((p) => ({ ...p, lastName: e.target.value }))} />
              </div>
              <Input label="Company" value={addressDraft.company} onChange={(e) => setAddressDraft((p) => ({ ...p, company: e.target.value }))} />
              <Input label="Address Line 1" value={addressDraft.address1} onChange={(e) => setAddressDraft((p) => ({ ...p, address1: e.target.value }))} />
              <Input label="Address Line 2" value={addressDraft.address2} onChange={(e) => setAddressDraft((p) => ({ ...p, address2: e.target.value }))} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="City" value={addressDraft.city} onChange={(e) => setAddressDraft((p) => ({ ...p, city: e.target.value }))} />
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-[var(--color-text)]">State</span>
                  <select
                    value={addressDraft.province}
                    onChange={(e) => setAddressDraft((p) => ({ ...p, province: e.target.value }))}
                    className="h-11 w-full rounded-2xl border px-4 text-sm text-[var(--color-text)] outline-none transition-all duration-200 focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[color:rgba(143,191,148,0.2)]"
                    style={{
                      backgroundColor: "var(--auth-input-bg)",
                      borderColor: "var(--auth-input-border)",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
                    }}
                  >
                    <option value="">Select state</option>
                    {INDIA_STATE_OPTIONS.map((stateName) => (
                      <option key={stateName} value={stateName}>
                        {stateName}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Country" value="India" readOnly disabled />
                <Input
                  label="ZIP / Postal Code"
                  inputMode="numeric"
                  maxLength={6}
                  value={addressDraft.zip}
                  onChange={(e) => setAddressDraft((p) => ({ ...p, zip: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
                />
              </div>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[var(--color-text)]">Phone</span>
                <div
                  className="flex h-11 items-center rounded-2xl border text-sm focus-within:border-[var(--color-brand)] focus-within:ring-2 focus-within:ring-[color:rgba(143,191,148,0.2)]"
                  style={{
                    backgroundColor: "var(--auth-input-bg)",
                    borderColor: "var(--auth-input-border)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
                  }}
                >
                  <span className="border-r px-3 text-[var(--auth-muted)]" style={{ borderColor: "var(--auth-input-border)" }}>
                    +91
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={phoneDigitsWithoutCountry(addressDraft.phone)}
                    onChange={(e) =>
                      setAddressDraft((p) => ({
                        ...p,
                        phone: normalizeIndianPhone(e.target.value),
                      }))
                    }
                    className="h-full w-full rounded-r-2xl bg-transparent px-3 text-[var(--color-text)] outline-none"
                    placeholder="10-digit mobile number"
                  />
                </div>
              </label>
              <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t pt-3" style={{ borderColor: "var(--auth-border)", backgroundColor: "var(--auth-surface-strong)" }}>
                <button
                  type="button"
                  disabled={addressSaving}
                  onClick={() => setAddressModalOpen(false)}
                  className="rounded-xl border border-[var(--color-secondary)]/35 px-4 py-2 text-sm font-semibold text-[var(--color-text)] hover:bg-[var(--color-secondary)]/20 disabled:opacity-60"
                >
                  Cancel
                </button>
                <Button type="submit" loading={addressSaving} className="w-auto px-5">
                  {addressDraft.id ? "Save Address" : "Add Address"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteAddressId && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => !deletingAddress && setDeleteAddressId(null)} />
          <div
            className="relative z-[96] w-full max-w-md rounded-2xl border p-5 shadow-[0_24px_70px_rgba(0,0,0,0.34)] backdrop-blur-xl"
            style={{ borderColor: "var(--auth-border)", backgroundColor: "var(--auth-surface-strong)" }}
          >
            <h4 className="font-serif text-2xl text-[var(--color-text)]">Delete Address?</h4>
            <p className="mt-2 text-sm text-[var(--auth-muted)]">This action cannot be undone.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={deletingAddress}
                onClick={() => setDeleteAddressId(null)}
                className="rounded-xl border border-[var(--color-secondary)]/35 px-4 py-2 text-sm font-semibold text-[var(--color-text)] hover:bg-[var(--color-secondary)]/20 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingAddress}
                onClick={removeAddress}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deletingAddress ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
