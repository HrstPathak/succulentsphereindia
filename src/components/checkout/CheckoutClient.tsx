"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Script from "next/script";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "../../context/CartContext";
import { formatINR } from "@/lib/currency";
import {
  calculateOrderPricing,
  FREE_SHIPPING_TAG_DISCOUNT_TITLE,
  MIN_ORDER_AMOUNT,
  FREE_SHIPPING_DISCOUNT_TITLE,
  PERCENT_DISCOUNT_TITLE,
} from "@/lib/pricing";
import { COD_DEPOSIT_AMOUNT, COD_FEE_AMOUNT, COD_ORDER_LIMIT } from "@/lib/checkoutConfig";
import { checkPincodeServiceability, normalizePincode } from "@/lib/pincodeServiceability";

type CheckoutStep = 1 | 2 | 3;

type InfoState = {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
};

type GatheringState = {
  deliverySlot: string;
  giftWrap: boolean;
  notes: string;
};

type PincodeStatus = "idle" | "checking" | "serviceable" | "unserviceable" | "error";

type RazorpayVerificationPayload = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

const STANDARD_DELIVERY_LABEL = "Standard (6-8 days)";
const EXPRESS_DELIVERY_LABEL = "Express (1-2 days) - Coming soon";
const GIFTING_DISABLED_MESSAGE = "Currently gifting is disabled.";

type CustomerAddress = {
  id: string;
  firstName: string;
  lastName: string;
  address1: string;
  address2: string;
  city: string;
  province: string;
  country: string;
  zip: string;
  phone: string;
};

type CustomerProfile = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  defaultAddressId: string | null;
  addresses: CustomerAddress[];
};

function calculateSubtotal(items: { price: string; quantity: number }[]) {
  return items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
}

function buildAddressLine(address?: CustomerAddress): string {
  if (!address) return "";
  return [address.address1, address.address2].filter(Boolean).join(", ").trim();
}

function buildAddressName(address: CustomerAddress, customer?: CustomerProfile | null): string {
  return [address.firstName || customer?.firstName || "", address.lastName || customer?.lastName || ""]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function composeFullAddress(baseAddress: string, landmark: string): string {
  const trimmedLandmark = landmark.trim();
  if (!trimmedLandmark) return baseAddress.trim();
  return [baseAddress.trim(), `Landmark: ${trimmedLandmark}`].filter(Boolean).join(", ");
}

export default function CheckoutClient() {
  const router = useRouter();
  const { items, clear } = useCart();
  const [step, setStep] = useState<CheckoutStep>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "processing" | "verifying" | "failed">("idle");
  const [paymentMethod, setPaymentMethod] = useState<"prepaid" | "cod_deposit">("prepaid");

  const [info, setInfo] = useState<InfoState>({
    fullName: "",
    email: "",
    phone: "",
    address: "",
    landmark: "",
    city: "",
    state: "",
    pincode: "",
  });

  const [gathering, setGathering] = useState<GatheringState>({
    deliverySlot: STANDARD_DELIVERY_LABEL,
    giftWrap: false,
    notes: "",
  });
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [pincodeStatus, setPincodeStatus] = useState<PincodeStatus>("idle");
  const [pincodeMessage, setPincodeMessage] = useState("");
  const [lastCheckedPincode, setLastCheckedPincode] = useState("");
  const [showNavigationWarning, setShowNavigationWarning] = useState(false);
  const pendingVerificationRef = useRef<RazorpayVerificationPayload | null>(null);
  const backgroundVerificationTriggeredRef = useRef(false);
  const isLoggedInCustomer = Boolean(customerProfile?.email);

  const subtotal = useMemo(() => calculateSubtotal(items), [items]);
  const pricing = useMemo(() => calculateOrderPricing(subtotal, items), [subtotal, items]);
  const shipping = pricing.shipping;
  const discount = pricing.discount;
  const total = pricing.total;
  const codFee = paymentMethod === "cod_deposit" ? COD_FEE_AMOUNT : 0;
  const totalWithCod = Number((total + codFee).toFixed(2));
  const shippingDisplay = pricing.shippingDiscount > 0 ? pricing.baseShipping : shipping;
  const freeShippingLabel =
    pricing.freeShippingSource === "tag" ? FREE_SHIPPING_TAG_DISCOUNT_TITLE : FREE_SHIPPING_DISCOUNT_TITLE;
  const hasMinimumOrder = subtotal >= MIN_ORDER_AMOUNT;
  const isCodEligible = total < COD_ORDER_LIMIT;
  const codLimitLabel = formatINR(COD_ORDER_LIMIT, 0);
  const isPaymentBusy = paymentStatus === "processing" || paymentStatus === "verifying";
  const isVerifyingPayment = paymentStatus === "verifying";

  function clearPendingVerification() {
    pendingVerificationRef.current = null;
    backgroundVerificationTriggeredRef.current = false;
  }

  function triggerBackgroundVerification() {
    if (typeof window === "undefined") return;

    const payload = pendingVerificationRef.current;
    if (!payload || backgroundVerificationTriggeredRef.current) return;

    const body = JSON.stringify(payload);
    let started = false;

    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      try {
        started = navigator.sendBeacon("/api/razorpay/verify", new Blob([body], { type: "application/json" }));
      } catch {
        started = false;
      }
    }

    if (!started) {
      void fetch("/api/razorpay/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => undefined);
      started = true;
    }

    backgroundVerificationTriggeredRef.current = started;
  }

  useEffect(() => {
    if (items.length > 0 && !hasMinimumOrder) {
      const t = setTimeout(() => router.replace("/cart"), 1200);
      return () => clearTimeout(t);
    }
  }, [hasMinimumOrder, items.length, router]);

  useEffect(() => {
    if (!isCodEligible && paymentMethod === "cod_deposit") {
      setPaymentMethod("prepaid");
    }
  }, [isCodEligible, paymentMethod]);

  useEffect(() => {
    if (!isPaymentBusy || typeof window === "undefined") return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isPaymentBusy]);

  useEffect(() => {
    if (!isVerifyingPayment || typeof window === "undefined") return;

    setShowNavigationWarning(false);

    const handlePopState = () => {
      setShowNavigationWarning(true);
      window.setTimeout(() => {
        window.history.forward();
      }, 0);
    };

    const handlePageHide = () => {
      triggerBackgroundVerification();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        triggerBackgroundVerification();
      }
    };

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      setShowNavigationWarning(false);
    };
  }, [isVerifyingPayment]);

  useEffect(() => {
    let cancelled = false;

    const prefillFromAccount = async () => {
      try {
        const response = await fetch("/api/customer", { method: "GET" });
        if (!response.ok) return;

        const payload = await response.json();
        const customer = payload?.customer as CustomerProfile | undefined;
        if (!customer || cancelled) return;

        setCustomerProfile(customer);
        setSavedAddresses(customer.addresses || []);

        const defaultAddress =
          customer.addresses?.find((address) => address.id === customer.defaultAddressId) ||
          customer.addresses?.[0];

        const fullName = [defaultAddress?.firstName || customer.firstName, defaultAddress?.lastName || customer.lastName]
          .filter(Boolean)
          .join(" ")
          .trim();

        setSelectedAddressId(defaultAddress?.id || null);

        setInfo((prev) => ({
          fullName: prev.fullName || fullName,
          email: prev.email || customer.email || "",
          phone: prev.phone || defaultAddress?.phone || customer.phone || "",
          address: prev.address || buildAddressLine(defaultAddress),
          landmark: prev.landmark || "",
          city: prev.city || defaultAddress?.city || "",
          state: prev.state || defaultAddress?.province || "",
          pincode: prev.pincode || normalizePincode(defaultAddress?.zip || ""),
        }));
      } catch {
        // Keep checkout usable for guests if profile lookup fails.
      }
    };

    prefillFromAccount();
    return () => {
      cancelled = true;
    };
  }, []);

  function applySavedAddress(address: CustomerAddress) {
    const fullName = buildAddressName(address, customerProfile);

    setSelectedAddressId(address.id);
    setInfo((prev) => ({
      ...prev,
      fullName: fullName || prev.fullName,
      email: prev.email || customerProfile?.email || "",
      phone: address.phone || customerProfile?.phone || "",
      address: buildAddressLine(address),
      landmark: "",
      city: address.city || "",
      state: address.province || "",
      pincode: normalizePincode(address.zip || ""),
    }));
  }

  async function checkDeliveryPincode(value: string) {
    const pincode = normalizePincode(value);
    if (pincode.length !== 6) {
      setPincodeStatus("idle");
      setPincodeMessage("");
      setLastCheckedPincode("");
      return;
    }

    setPincodeStatus("checking");
    setPincodeMessage("Checking delivery availability...");

    try {
      const response = await checkPincodeServiceability(pincode);
      setLastCheckedPincode(pincode);
      if (response.serviceable) {
        setPincodeStatus("serviceable");
        setInfo((prev) => ({
          ...prev,
          city: response.city || prev.city,
          state: response.state || prev.state,
        }));
      } else {
        setPincodeStatus("unserviceable");
      }
      setPincodeMessage(response.message);
    } catch (checkError) {
      setLastCheckedPincode(pincode);
      setPincodeStatus("error");
      setPincodeMessage((checkError as Error).message || "Unable to verify pincode right now.");
    }
  }

  useEffect(() => {
    const pincode = normalizePincode(info.pincode);
    if (pincode.length !== 6) {
      if (pincodeStatus !== "idle") {
        setPincodeStatus("idle");
        setPincodeMessage("");
      }
      setLastCheckedPincode("");
      return;
    }

    if (pincode === lastCheckedPincode) return;

    const timer = setTimeout(() => {
      void checkDeliveryPincode(pincode);
    }, 350);

    return () => clearTimeout(timer);
  }, [info.pincode, lastCheckedPincode, pincodeStatus]);

  function validateInformation() {
    if (!info.fullName || !info.email || !info.phone || !info.address || !info.city || !info.state || !info.pincode) {
      setError("Please fill all Information fields.");
      return false;
    }
    const normalizedPincode = normalizePincode(info.pincode);
    if (normalizedPincode.length !== 6) {
      setError("Please enter a valid 6-digit pincode.");
      return false;
    }
    if (pincodeStatus === "checking") {
      setError("Please wait while we verify pincode serviceability.");
      return false;
    }
    if (lastCheckedPincode !== normalizedPincode) {
      setError("Please verify pincode serviceability before continuing.");
      return false;
    }
    if (pincodeStatus !== "serviceable") {
      setError("This pincode is currently not serviceable for delivery.");
      return false;
    }
    setError(null);
    return true;
  }

  function handleStepChange(next: CheckoutStep) {
    setStep(next);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function startPayment(mode: "prepaid" | "cod_deposit") {
    if (!items.length) {
      setError("Your cart is empty.");
      return;
    }
    if (!hasMinimumOrder) {
      setError(`Minimum order is ${formatINR(MIN_ORDER_AMOUNT, 0)}. Please add more items before payment.`);
      return;
    }
    if (mode === "cod_deposit" && !isCodEligible) {
      setError(`Cash on Delivery is reserved for orders below ${codLimitLabel}.`);
      setPaymentMethod("prepaid");
      return;
    }

    const orderTotal = mode === "cod_deposit" ? Number((total + COD_FEE_AMOUNT).toFixed(2)) : total;

    setLoading(true);
    setError(null);
    setPaymentStatus("processing");

    try {
      const customerPayload = { ...info, address: composeFullAddress(info.address, info.landmark) };
      const createOrderRes = await fetch("/api/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          customer: customerPayload,
          gathering,
          paymentMode: mode,
        }),
      });

      const orderData = await createOrderRes.json();
      if (!createOrderRes.ok) {
        throw new Error(orderData?.error || "Failed to create payment order.");
      }

      const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
      const Razorpay = (window as any).Razorpay;

      if (!keyId) {
        throw new Error("Missing NEXT_PUBLIC_RAZORPAY_KEY_ID");
      }
      if (!Razorpay) {
        throw new Error("Razorpay SDK failed to load.");
      }

      const options = {
        key: keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Succulent Sphere",
        description: "Succulent Sphere Custom Checkout",
        order_id: orderData.id,
        prefill: {
          name: info.fullName,
          email: info.email,
          contact: info.phone,
        },
        notes: {
          address: info.address,
          delivery_slot: gathering.deliverySlot,
          gift_wrap: gathering.giftWrap ? "yes" : "no",
        },
        theme: {
          color: "#344E41",
        },
        handler: async (response: any) => {
          const verificationPayload: RazorpayVerificationPayload = {
            razorpay_order_id: String(response?.razorpay_order_id || "").trim(),
            razorpay_payment_id: String(response?.razorpay_payment_id || "").trim(),
            razorpay_signature: String(response?.razorpay_signature || "").trim(),
          };

          try {
            setPaymentStatus("verifying");
            setShowNavigationWarning(false);
            pendingVerificationRef.current = verificationPayload;
            backgroundVerificationTriggeredRef.current = false;

            const verifyRes = await fetch("/api/razorpay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(verificationPayload),
              keepalive: true,
            });

            const verifyText = await verifyRes.text();
            let verifyData: any = null;
            try {
              verifyData = verifyText ? JSON.parse(verifyText) : null;
            } catch {
              verifyData = null;
            }
            if (!verifyRes.ok || !verifyData?.verified) {
              console.error("[checkout verify error]", {
                status: verifyRes.status,
                verifyData,
                verifyText,
              });
              const errorMessage =
                verifyData?.error ||
                (verifyText && verifyText.slice(0, 200)) ||
                "Payment verification failed.";
              throw new Error(errorMessage);
            }

            clearPendingVerification();

            // Persist purchase analytics payload so order success page can push GA4 purchase event on load.
            if (typeof window !== "undefined") {
              const purchaseItems = items
                .map((line) => {
                  const itemId = String(line.id || "").trim();
                  const itemName = String(line.title || "").trim();
                  const itemCategory = String(line.itemCategory || "").trim();
                  const price = Number(line.price);
                  const quantity = Number(line.quantity || 1);

                  if (!itemId || !itemName || !price) return null;
                  return {
                    item_id: itemId,
                    item_name: itemName,
                    item_category: itemCategory,
                    price,
                    quantity,
                  };
                })
                .filter(
                  (line): line is { item_id: string; item_name: string; item_category: string; price: number; quantity: number } =>
                    line !== null
                );

              if (purchaseItems.length > 0) {
                const purchasePayload = {
                  id: String(response.razorpay_order_id || "").trim(),
                  totalAmount: orderTotal,
                  taxAmount: 0,
                  shippingAmount: shipping,
                  items: purchaseItems,
                };

                sessionStorage.setItem("ss_purchase_payload", JSON.stringify(purchasePayload));
              }
            }

            const paidAmount = mode === "cod_deposit" ? COD_DEPOSIT_AMOUNT : Number(orderTotal.toFixed(2));
            const nextParams = new URLSearchParams({
              orderId: String(response.razorpay_order_id || "").trim(),
              paymentId: String(response.razorpay_payment_id || "").trim(),
              amount: String(paidAmount.toFixed(2)),
              paymentMode: mode,
            });

            if (verifyData?.orderNumber) {
              nextParams.set("orderNumber", String(verifyData.orderNumber));
            }

            clear();
            router.replace(`/order-placed?${nextParams.toString()}`);
          } catch (verificationError) {
            clearPendingVerification();
            setPaymentStatus("failed");
            setError((verificationError as Error).message);
          }
        },
        modal: {
          ondismiss: () => {
            setPaymentStatus("idle");
          },
          escape: false,
          backdropclose: false,
          confirm_close: true,
        },
      };

      const rzp = new Razorpay(options);
      rzp.on("payment.failed", (failure: any) => {
        setPaymentStatus("failed");
        setError(failure?.error?.description || "Payment failed. Please try again.");
      });

      // Push checkout payment intent event before opening payment gateway modal.
      if (typeof window !== "undefined") {
        const checkoutItems = items
          .map((line) => {
            const itemId = String(line.id || "").trim();
            const itemName = String(line.title || "").trim();
            const itemCategory = String(line.itemCategory || "").trim();
            const price = Number(line.price);
            const quantity = Number(line.quantity || 1);

            if (!itemId || !itemName || !price) return null;
            return {
              item_id: itemId,
              item_name: itemName,
              item_category: itemCategory,
              price,
              quantity,
            };
          })
          .filter(
            (line): line is { item_id: string; item_name: string; item_category: string; price: number; quantity: number } =>
              line !== null
          );

        if (checkoutItems.length > 0) {
          const dataLayerTarget = window as Window & { dataLayer?: Array<Record<string, unknown>> };
          dataLayerTarget.dataLayer = dataLayerTarget.dataLayer || [];
          dataLayerTarget.dataLayer.push({ ecommerce: null });
          dataLayerTarget.dataLayer.push({
            event: "add_payment_info",
            ecommerce: {
              currency: "INR",
              value: orderTotal,
              items: checkoutItems,
            },
          });
        }
      }

      rzp.open();
    } catch (paymentError) {
      setPaymentStatus("failed");
      setError((paymentError as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (!items.length) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-xl font-semibold mb-2">Your cart is empty</h2>
        <p className="text-sm text-gray-600 mb-5">Add items to your cart before checkout.</p>
        <Link href="/collections" className="inline-block bg-[var(--color-brand)] text-white px-4 py-2 rounded-md text-sm">
          Browse Collections
        </Link>
      </div>
    );
  }

  if (!hasMinimumOrder) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-xl font-semibold mb-2">Minimum Order Required</h2>
        <p className="text-sm text-gray-600 mb-2">
          Your subtotal is {formatINR(subtotal)}. Minimum order for checkout is {formatINR(MIN_ORDER_AMOUNT, 0)}.
        </p>
        <p className="text-xs text-gray-500 mb-5">Redirecting you to cart...</p>
        <Link href="/cart" className="inline-block bg-[var(--color-brand)] text-white px-4 py-2 rounded-md text-sm">
          Go to Cart
        </Link>
      </div>
    );
  }

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />

      {isVerifyingPayment && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-[#24362d]/55 px-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-live="assertive"
            className="w-full max-w-md rounded-[1.75rem] border border-[#d7cdbf] bg-[linear-gradient(145deg,#fffaf1_0%,#f6f0e6_60%,#edf3ea_100%)] p-6 text-[#2f4138] shadow-[0_35px_70px_-38px_rgba(42,54,45,0.82)]"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full border-2 border-[#cad6c5] border-t-[var(--color-brand)] animate-spin" />
              <div>
                <p className="text-base font-semibold text-[#22312a]">Confirming your payment</p>
                <p className="text-sm text-[#4b5d54]">We&apos;re verifying your payment and creating your order now.</p>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-900">
              {showNavigationWarning
                ? "Back navigation is blocked until verification finishes. Please stay on this page for a few more seconds."
                : "Please do not press back, refresh, or close this tab until verification is complete."}
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--color-secondary)]/25">
              <div className="h-full w-1/3 bg-[var(--color-brand)] animate-[paymentBar_1.4s_ease_infinite]" />
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-2 text-xs font-semibold mb-6">
            <span className={step >= 1 ? "text-[var(--color-brand)]" : "text-gray-400"}>1. Information</span>
            <span className="text-gray-300">/</span>
            <span className={step >= 2 ? "text-[var(--color-brand)]" : "text-gray-400"}>2. Gathering</span>
            <span className="text-gray-300">/</span>
            <span className={step >= 3 ? "text-[var(--color-brand)]" : "text-gray-400"}>3. Payment</span>
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Information</h3>

              {savedAddresses.length > 1 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Choose from your saved addresses</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {savedAddresses.map((address) => {
                      const isSelected = selectedAddressId === address.id;
                      const addressName = buildAddressName(address, customerProfile) || "Saved Address";

                      return (
                        <button
                          key={address.id}
                          type="button"
                          onClick={() => applySavedAddress(address)}
                          className={`text-left border rounded p-3 transition ${
                            isSelected ? "border-[var(--color-brand)] bg-[var(--color-brand)]/5" : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <p className="text-sm font-semibold">{addressName}</p>
                          <p className="text-xs text-gray-600 mt-1">{buildAddressLine(address) || "No street address"}</p>
                          <p className="text-xs text-gray-600">{[address.city, address.province, address.zip].filter(Boolean).join(", ")}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input className="border rounded px-3 py-2 text-sm" placeholder="Full Name" value={info.fullName} onChange={(e) => setInfo((s) => ({ ...s, fullName: e.target.value }))} />
                <input
                  className={`border rounded px-3 py-2 text-sm ${isLoggedInCustomer ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}`}
                  placeholder="Email"
                  value={info.email}
                  onChange={(e) => setInfo((s) => ({ ...s, email: e.target.value }))}
                  disabled={isLoggedInCustomer}
                  readOnly={isLoggedInCustomer}
                  aria-disabled={isLoggedInCustomer}
                />
                <input className="border rounded px-3 py-2 text-sm" placeholder="Phone Number" value={info.phone} onChange={(e) => setInfo((s) => ({ ...s, phone: e.target.value }))} />
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      className="w-full border rounded px-3 py-2 text-sm"
                      placeholder="Pincode"
                      inputMode="numeric"
                      maxLength={6}
                      value={info.pincode}
                      onChange={(e) => {
                        const pincode = normalizePincode(e.target.value);
                        setInfo((s) => ({ ...s, pincode }));
                        setError(null);
                      }}
                    />
                    <button
                      type="button"
                      className="rounded border border-[var(--color-brand)] px-3 py-2 text-xs font-semibold text-[var(--color-brand)] disabled:opacity-60"
                      onClick={() => void checkDeliveryPincode(info.pincode)}
                      disabled={normalizePincode(info.pincode).length !== 6 || pincodeStatus === "checking"}
                    >
                      {pincodeStatus === "checking" ? "Checking..." : "Check"}
                    </button>
                  </div>
                  {pincodeStatus !== "idle" && (
                    <p
                      className={`text-xs ${
                        pincodeStatus === "serviceable"
                          ? "text-emerald-700"
                          : pincodeStatus === "checking"
                            ? "text-slate-600"
                            : "text-red-600"
                      }`}
                    >
                      {pincodeMessage}
                    </p>
                  )}
                </div>
                <input className="border rounded px-3 py-2 text-sm md:col-span-2" placeholder="Address" value={info.address} onChange={(e) => setInfo((s) => ({ ...s, address: e.target.value }))} />
                <input className="border rounded px-3 py-2 text-sm md:col-span-2" placeholder="Landmark (Optional)" value={info.landmark} onChange={(e) => setInfo((s) => ({ ...s, landmark: e.target.value }))} />
                <input className="border rounded px-3 py-2 text-sm" placeholder="City" value={info.city} onChange={(e) => setInfo((s) => ({ ...s, city: e.target.value }))} />
                <input className="border rounded px-3 py-2 text-sm" placeholder="State" value={info.state} onChange={(e) => setInfo((s) => ({ ...s, state: e.target.value }))} />
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  className="bg-[var(--color-brand)] text-white px-4 py-2 rounded text-sm"
                  onClick={() => {
                    if (validateInformation()) handleStepChange(2);
                  }}
                >
                  Continue to Gathering
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Gathering</h3>
              <div>
                <label className="text-sm font-medium mb-1 block">Delivery Slot</label>
                <select
                  className="w-full rounded-lg border border-[var(--auth-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-text)] shadow-sm focus:border-[var(--color-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand)]"
                  value={gathering.deliverySlot}
                  onChange={(e) => setGathering((s) => ({ ...s, deliverySlot: e.target.value }))}
                >
                  <option value={STANDARD_DELIVERY_LABEL}>{STANDARD_DELIVERY_LABEL}</option>
                  <option value={EXPRESS_DELIVERY_LABEL} disabled>
                    {EXPRESS_DELIVERY_LABEL}
                  </option>
                </select>
                <p className="mt-1 text-xs text-[var(--auth-muted)]">Express delivery is currently unavailable.</p>
              </div>
              <label className="text-sm flex items-center gap-2 text-[var(--auth-muted)]">
                <input
                  type="checkbox"
                  checked={false}
                  disabled
                  aria-disabled="true"
                  className="cursor-not-allowed"
                />
                Add gift wrap
              </label>
              <p className="text-xs text-[var(--auth-muted)]">{GIFTING_DISABLED_MESSAGE}</p>
              <div>
                <label className="text-sm font-medium mb-1 block">Order Notes</label>
                <textarea
                  className="border rounded px-3 py-2 text-sm w-full min-h-24"
                  placeholder="Any special instructions?"
                  value={gathering.notes}
                  onChange={(e) => setGathering((s) => ({ ...s, notes: e.target.value }))}
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button type="button" className="px-4 py-2 rounded text-sm border" onClick={() => handleStepChange(1)}>
                  Back
                </button>
                <button type="button" className="bg-[var(--color-brand)] text-white px-4 py-2 rounded text-sm" onClick={() => handleStepChange(3)}>
                  Continue to Payment
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Payment</h3>
              <div className="space-y-3">
                <label className="flex items-start gap-3 rounded-lg border border-[var(--auth-border)] bg-white/80 p-3">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="prepaid"
                    checked={paymentMethod === "prepaid"}
                    onChange={() => setPaymentMethod("prepaid")}
                    className="mt-1"
                  />
                    <div>
                    <p className="text-sm font-semibold text-[var(--color-text)]">Pay Online (Razorpay)</p>
                    <p className="text-xs text-[var(--auth-muted)]">Pay the full amount securely online.</p>
                  </div>
                </label>
 
                {isCodEligible && (
                  <label className="flex items-start gap-3 rounded-lg border border-[var(--auth-border)] bg-white/80 p-3">
                    <input
                    type="radio"
                    name="paymentMethod"
                    value="cod_deposit"
                    checked={paymentMethod === "cod_deposit"}
                    onChange={() => setPaymentMethod("cod_deposit")}
                    className="mt-1"
                  />                  <div>
                    <p className="text-sm font-semibold text-[var(--color-text)]">
                      Cash on Delivery ({formatINR(COD_DEPOSIT_AMOUNT, 0)} security deposit)
                    </p>
                    <p className="text-xs text-[var(--auth-muted)]">
                      Pay {formatINR(COD_DEPOSIT_AMOUNT, 0)} now to confirm your order. The balance is paid at delivery.
                    </p>
                    <p className="text-xs text-amber-700">
                      {formatINR(COD_FEE_AMOUNT, 0)} COD fee is added to your order total and collected at delivery.
                    </p>
                  </div>
                  </label>
                )}
              </div>
              {!isCodEligible && (
                <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/70 px-4 py-3 text-xs text-emerald-900">
                  <p className="font-semibold">Cash on Delivery Eligibility</p>
                  <p className="mt-1">
                    Cash on Delivery is reserved for orders below {codLimitLabel}. For higher totals, please proceed with
                    secure online payment.
                  </p>
                </div>
              )}

              {isPaymentBusy && (
                <div role="status" aria-live="polite" className="rounded-lg border border-[var(--auth-border)] bg-white/70 p-3">
                  <p className="text-xs font-semibold text-[var(--color-text)]">
                    {paymentStatus === "verifying" ? "Payment received. Confirming your order..." : "Processing your payment..."}
                  </p>
                  <p className="mt-1 text-xs text-[var(--auth-muted)]">
                    Please wait here and do not press back, refresh, or close the tab until order confirmation finishes.
                  </p>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--color-secondary)]/25">
                    <div className="h-full w-1/3 bg-[var(--color-brand)] animate-[paymentBar_1.4s_ease_infinite]" />
                  </div>
                </div>
              )}
              {paymentStatus === "failed" && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                  Transaction failed. Please try again or use a different payment method.
                </div>
              )}
              {paymentMethod === "cod_deposit" && (
                <div className="rounded-xl border border-amber-200/70 bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="font-semibold">Why we take {formatINR(COD_DEPOSIT_AMOUNT, 0)}</p>
                  <p className="mt-1 text-xs">
                    This refundable security deposit helps prevent fake COD orders and ensures we ship only confirmed purchases.
                  </p>
                  <p className="mt-2 text-xs">
                    After you pay the deposit, we create your COD order. The remaining balance is collected at delivery.
                  </p>
                  <p className="mt-2 text-xs">
                    A {formatINR(COD_FEE_AMOUNT, 0)} COD fee is added to your order total and collected at delivery.
                  </p>
                </div>
              )}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  className="px-4 py-2 rounded text-sm border disabled:opacity-60"
                  onClick={() => handleStepChange(2)}
                  disabled={isPaymentBusy}
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={loading || isPaymentBusy}
                  className="bg-[var(--color-brand)] text-white px-4 py-2 rounded text-sm disabled:opacity-60"
                  onClick={() => startPayment(paymentMethod)}
                >
                  {loading
                    ? "Processing..."
                    : paymentMethod === "cod_deposit"
                    ? `Pay ${formatINR(COD_DEPOSIT_AMOUNT, 0)} Deposit`
                    : "Pay Now"}
                </button>
              </div>
            </div>
          )}

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        </div>

        <aside className="bg-white rounded-xl shadow-sm p-6 h-fit">
          <div className="mb-5 overflow-hidden rounded-xl border border-[#d8d1c4] bg-[linear-gradient(140deg,#fff7ec_0%,#f4efe6_55%,#ecf2e8_100%)] shadow-[0_16px_36px_-30px_rgba(36,54,45,0.85)]">
            <div className="bg-[linear-gradient(90deg,#1d4534_0%,#6a8257_52%,#b98a63_100%)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
              Order Confirmation Note
            </div>
            <ul className="list-disc space-y-1.5 px-7 py-3 text-sm leading-relaxed text-[#30453a]">
              <li>
                Once your payment is processed, expect a confirmation <strong>call</strong> or a <strong>WhatsApp</strong> message from our team within 24 hours. We&apos;ll verify your order and get your plants ready for their new home.
              </li>
              <li>
                From our greenhouse to your door—we&apos;ll send you arrival-ready photos of your plants so you can track their journey with confidence.
              </li>
            </ul>
          </div>
          <h3 className="text-lg font-semibold mb-4">Order Summary</h3>
          <div className="space-y-3 mb-4">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">
                  {item.title} x {item.quantity}
                </span>
                <span className="font-medium">{formatINR(Number(item.price) * item.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="border-t pt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span>Subtotal</span>
              <span>{formatINR(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Shipping</span>
              <span>{shippingDisplay === 0 ? "Free" : formatINR(shippingDisplay)}</span>
            </div>
            {pricing.shippingDiscount > 0 && (
              <div className="flex items-center justify-between text-green-700">
                <span>{freeShippingLabel}</span>
                <span>-{formatINR(pricing.shippingDiscount)}</span>
              </div>
            )}
            {discount > 0 && (
              <div className="flex items-center justify-between text-green-700">
                <span>Discount (5%)</span>
                <span>-{formatINR(discount)}</span>
              </div>
            )}
            {pricing.hasDiscount && (
              <div className="flex items-center justify-between text-green-700">
                <span>{PERCENT_DISCOUNT_TITLE}</span>
                <span>Applied</span>
              </div>
            )}
            {paymentMethod === "cod_deposit" && (
              <>
                <div className="flex items-center justify-between text-amber-800">
                  <span>COD Fee</span>
                  <span>{formatINR(COD_FEE_AMOUNT)}</span>
                </div>
                <div className="flex items-center justify-between text-amber-800">
                  <span>COD Security Deposit (Paid)</span>
                  <span>-{formatINR(COD_DEPOSIT_AMOUNT)}</span>
                </div>
                <div className="flex items-center justify-between text-amber-900">
                  <span>Balance Due on Delivery</span>
                  <span>{formatINR(Math.max(totalWithCod - COD_DEPOSIT_AMOUNT, 0))}</span>
                </div>
              </>
            )}
            <div className="flex items-center justify-between font-semibold text-base">
              <span>Total</span>
              <span>{formatINR(paymentMethod === "cod_deposit" ? totalWithCod : total)}</span>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}




