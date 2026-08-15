"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Mail,
  Package,
  Pencil,
  Search,
  Send,
  Sparkles,
  Star,
  Users,
  X,
} from "lucide-react";
import AdminTestOrderModal from "./AdminTestOrderModal";
import dynamic from "next/dynamic";
const AdminOrderDetailModal = dynamic(() => import("./AdminOrderDetailModal"), { ssr: false });

type Product = {
  id: string;
  title: string;
  handle: string;
  price: number;
  inventoryQuantity: number;
  available: boolean;
  status: string;
  image: string;
  tags: string[];
};
type Order = {
  id: string;
  orderNumber: number;
  customerName: string;
  email: string;
  total: number;
  paymentMode: string;
  financialStatus: string;
  fulfillmentStatus: string;
  createdAt: string;
  emailStatus: string;
  itemCount: number;
  tracking: { number?: string; url?: string; company?: string }[];
};
type Customer = {
  id: string;
  email: string;
  name: string;
  phone: string;
  createdAt: string;
  wishlistCount: number;
};
type Review = {
  id: string;
  productId: string;
  authorName: string;
  title: string;
  content: string;
  rating: number;
  status: string;
  createdAt: string;
  verifiedPurchase: boolean;
};
type Data = {
  summary: {
    products: number;
    lowStock: number;
    outOfStock: number;
    orders: number;
    paidRevenue: number;
    customers: number;
    reviews: number;
  };
  products: Product[];
  orders: Order[];
  customers: Customer[];
  reviews: Review[];
};
type Tab =
  "overview" | "products" | "orders" | "customers" | "reviews" | "mail";
type ProductPriceSort = "default" | "price_asc" | "price_desc";
type ProductDetail = Product & {
  description: string;
  compareAtPrice: number | null;
  collections: string[];
  productType: string;
  careLevel: string;
  indoorOutdoor: string;
  imageAlt: string;
  images: string[];
  seoTitle: string;
  seoDescription: string;
  vendor: string;
};
type ProductResponse = { product: ProductDetail; reviews: Review[] };
type CustomerResponse = {
  customer: Customer & {
    firstName: string;
    lastName: string;
    displayName: string;
    updatedAt: string;
    wishlistProductIds: string[];
    defaultAddressId: string;
  };
  addresses: Array<Record<string, unknown> & { id: string }>;
  orders: Order[];
  reviews: Review[];
};

const inr = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);
const date = (value: string) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";
const toList = (value: string) =>
  value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

const normalizeImageList = (value: unknown) =>
  Array.from(
    new Set(
      (Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [])
        .map((entry) => String(entry).trim())
        .filter(Boolean),
    ),
  );

const tagSuggestions = [
  "best seller",
  "featured",
  "new arrival",
  "limited edition",
  "indoor",
  "outdoor",
  "giftable",
  "easy care",
  "pet friendly",
  "combo",
];

function Status({
  children,
  tone = "stone",
}: {
  children: string;
  tone?: "green" | "amber" | "red" | "stone";
}) {
  const classes = {
    green: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-rose-100 text-rose-800",
    stone: "bg-stone-200 text-stone-700",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${classes[tone]}`}
    >
      {children}
    </span>
  );
}

export default function AdminDashboard({ adminEmail }: { adminEmail: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [query, setQuery] = useState("");
  const [productPriceSort, setProductPriceSort] = useState<ProductPriceSort>("default");
  const [selected, setSelected] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [bulk, setBulk] = useState({
    price: "",
    inventoryQuantity: "",
    status: "",
    available: "",
    tags: "",
  });
  const [mail, setMail] = useState({ to: "", subject: "", message: "" });
  const [productId, setProductId] = useState<string | null>(null);
  const [createProductOpen, setCreateProductOpen] = useState(false);
  const productTagOptions = useMemo(() => {
    const createdTags = (data?.products || []).flatMap((product) => product.tags || []);
    return [...new Set([...tagSuggestions, ...createdTags.map((tag) => tag.trim()).filter(Boolean)])].sort((left, right) => left.localeCompare(right));
  }, [data]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [testOrderOpen, setTestOrderOpen] = useState(false);
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const load = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/dashboard", {
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error || "Unable to load store data.");
      setData(payload);
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const search = query.trim().toLowerCase();
  const products = useMemo(() => {
    const filtered = (data?.products || []).filter(
        (item) =>
          !search ||
          [item.title, item.handle, item.status, item.tags.join(" ")]
            .join(" ")
            .toLowerCase()
            .includes(search),
      );
    if (productPriceSort === "default") return filtered;
    return [...filtered].sort((left, right) =>
      productPriceSort === "price_asc" ? left.price - right.price : right.price - left.price,
    );
  }, [data, search, productPriceSort]);
  const orders = useMemo(
    () =>
      (data?.orders || []).filter(
        (item) =>
          !search ||
          [
            item.orderNumber,
            item.customerName,
            item.email,
            item.fulfillmentStatus,
          ]
            .join(" ")
            .toLowerCase()
            .includes(search),
      ),
    [data, search],
  );
  const customers = useMemo(
    () =>
      (data?.customers || []).filter(
        (item) =>
          !search ||
          [item.name, item.email, item.phone]
            .join(" ")
            .toLowerCase()
            .includes(search),
      ),
    [data, search],
  );
  const reviews = useMemo(
    () =>
      (data?.reviews || []).filter(
        (item) =>
          !search ||
          [item.authorName, item.title, item.content, item.productId]
            .join(" ")
            .toLowerCase()
            .includes(search),
      ),
    [data, search],
  );
  const mutate = async (url: string, body: unknown) => {
    setBusy(true);
    try {
      const response = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Update failed.");
      setNotice("Saved successfully.");
      await load();
      return true;
    } catch (error) {
      setNotice((error as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const saveBulk = async () => {
    const changes: Record<string, unknown> = {};
    if (bulk.price) changes.price = Number(bulk.price);
    if (bulk.inventoryQuantity)
      changes.inventoryQuantity = Number(bulk.inventoryQuantity);
    if (bulk.status) changes.status = bulk.status;
    if (bulk.available) changes.available = bulk.available === "true";
    if (bulk.tags) changes.tags = bulk.tags;
    if (await mutate("/api/admin/products", { ids: selected, changes })) {
      setSelected([]);
      setBulk({
        price: "",
        inventoryQuantity: "",
        status: "",
        available: "",
        tags: "",
      });
    }
  };
  const updateOrder = async (order: Order) => {
    const fulfillmentStatus = window.prompt(
      "Fulfillment status: UNFULFILLED, FULFILLED, DELIVERED, or CANCELLED",
      order.fulfillmentStatus,
    );
    if (!fulfillmentStatus) return;
    const trackingNumber = window.prompt(
      "Tracking number (leave blank to keep current)",
      order.tracking?.[0]?.number || "",
    );
    const trackingUrl = trackingNumber
      ? window.prompt("Tracking URL (optional)", order.tracking?.[0]?.url || "")
      : "";
    const carrier = trackingNumber
      ? window.prompt(
          "Carrier name (optional)",
          order.tracking?.[0]?.company || "",
        )
      : "";
    await mutate("/api/admin/orders", {
      id: order.id,
      fulfillmentStatus,
      trackingNumber,
      trackingUrl,
      carrier,
    });
  };
  const sendMail = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mail),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error || "Email could not be sent.");
      setNotice("Email sent.");
      setMail({ to: "", subject: "", message: "" });
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const tabs = [
    ["overview", "Command Center", Sparkles],
    ["products", "Products", Package],
    ["orders", "Orders", ClipboardList],
    ["customers", "Customers", Users],
    ["reviews", "Reviews", Star],
    ["mail", "Mail", Mail],
  ] as const;
  if (!data && busy)
    return (
      <main className="min-h-screen bg-[#e8ece6] p-10">
        <div className="mx-auto max-w-7xl animate-pulse rounded-[32px] bg-white p-10 text-[#31533e]">
          Opening your private store control room…
        </div>
      </main>
    );
  if (!data)
    return (
      <main className="min-h-screen bg-[#e8ece6] p-10">
        <div className="mx-auto max-w-xl rounded-[32px] bg-white p-10 text-center">
          <p className="text-lg font-bold">Store control could not load.</p>
          <button
            onClick={() => void load()}
            className="mt-4 rounded-full bg-[#1f4a35] px-5 py-2 text-white"
          >
            Try again
          </button>
        </div>
      </main>
    );
  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_8%_2%,#fffdf4_0,transparent_28%),radial-gradient(circle_at_93%_7%,#bbd5bf_0,transparent_24%),linear-gradient(135deg,#dce4dc_0%,#f6f3ea_46%,#c9d9cf_100%)] p-3 text-[#1c3328] sm:p-6">
      <div className="mx-auto grid max-w-[1600px] gap-5 lg:grid-cols-[240px_1fr]">
        <aside className="relative overflow-hidden rounded-[30px] border border-white/70 bg-[#173c2d] p-5 text-white shadow-[18px_24px_38px_rgba(42,69,52,.22),inset_1px_1px_0_rgba(255,255,255,.14)]">
          <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-[#d9a871]/25 blur-2xl" />
          <div className="relative">
            <p className="text-[10px] font-bold tracking-[.28em] text-[#c8e0cd]">
              PRIVATE
            </p>
            <h1 className="mt-2 font-serif text-3xl">Store Control</h1>
            <p className="mt-2 break-all text-xs text-white/60">{adminEmail}</p>
            <nav className="mt-8 space-y-1">
              {tabs.map(([id, label, Icon]) => (
                <button
                  key={id}
                  onClick={() => {
                    setTab(id);
                    setQuery("");
                    setSelected([]);
                  }}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm transition ${tab === id ? "bg-white text-[#1e4c36] shadow-[0_12px_20px_rgba(0,0,0,.16)]" : "text-white/72 hover:bg-white/10 hover:text-white"}`}
                >
                  <Icon size={17} />
                  {label}
                  <ChevronRight size={14} className="ml-auto opacity-50" />
                </button>
              ))}
            </nav>
            <div className="mt-8 rounded-2xl border border-white/15 bg-white/10 p-3 text-xs leading-relaxed text-white/70">
              Only email addresses listed in <code>ADMIN_EMAILS</code> can open
              this screen.
            </div>
          </div>
        </aside>
        <section className="min-w-0">
          <header className="mb-5 flex flex-col gap-4 rounded-[28px] border border-white/80 bg-white/75 p-5 shadow-[14px_17px_30px_rgba(61,83,67,.16),inset_1px_1px_0_white] backdrop-blur md:flex-row md:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.2em] text-[#6e826f]">
                Succulent Sphere
              </p>
              <h2 className="mt-1 font-serif text-3xl">
                {tabs.find(([id]) => id === tab)?.[1]}
              </h2>
            </div>
            {tab !== "overview" && tab !== "mail" && (
              <label className="relative ml-auto block w-full max-w-md">
                <Search
                  className="absolute left-3 top-3 text-[#698170]"
                  size={17}
                />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search this workspace…"
                  className="w-full rounded-2xl border border-[#d7e0d9] bg-white px-10 py-2.5 text-sm outline-none ring-[#6f9878] focus:ring-2"
                />
              </label>
            )}
            <button
              onClick={() => void load()}
              className="rounded-2xl border border-[#d5dfd5] bg-white px-4 py-2.5 text-sm font-bold shadow-[0_5px_0_#d4ddd4] active:translate-y-1 active:shadow-none"
            >
              Refresh
            </button>
          </header>
          {notice && (
            <div className="mb-4 flex items-center justify-between rounded-2xl border border-[#d5e4d7] bg-[#eff9ef] px-4 py-3 text-sm font-medium text-[#2c633c]">
              <span>{notice}</span>
              <button onClick={() => setNotice("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {tab === "overview" && (
            <Overview data={data} onGo={(next) => setTab(next)} />
          )}{" "}
          {tab === "products" && (
            <Products
              rows={products}
              selected={selected}
              setSelected={setSelected}
              bulk={bulk}
              setBulk={setBulk}
              save={saveBulk}
              busy={busy}
              open={setProductId}
              onCreateNew={() => setCreateProductOpen(true)}
              priceSort={productPriceSort}
              setPriceSort={setProductPriceSort}
            />
          )}{" "}
          {tab === "orders" && (
            <Orders
                rows={orders}
                update={updateOrder}
                busy={busy}
                onCreateTest={() => setTestOrderOpen(true)}
                onOpenOrder={(id) => setOpenOrderId(id)}
              />
          )}{" "}
          {tab === "customers" && (
            <Customers
              rows={customers}
              onEmail={(to) => {
                setMail((value) => ({ ...value, to }));
                setTab("mail");
              }}
              open={setCustomerId}
            />
          )}{" "}
          {tab === "reviews" && (
            <Reviews
              rows={reviews}
              update={(id, status) =>
                void mutate("/api/admin/reviews", { id, status })
              }
            />
          )}{" "}
          {tab === "mail" && (
            <MailComposer
              mail={mail}
              setMail={setMail}
              send={sendMail}
              busy={busy}
            />
          )}
        </section>
      </div>
      {productId && (
        <ProductEditor
          id={productId}
          availableTags={productTagOptions}
          onClose={() => setProductId(null)}
          onSaved={() => {
            void load();
            setNotice("Product saved.");
          }}
        />
      )}
      {customerId && (
        <CustomerDetails
          id={customerId}
          onClose={() => setCustomerId(null)}
          onEmail={(to) => {
            setCustomerId(null);
            setMail((current) => ({ ...current, to }));
            setTab("mail");
          }}
          updateOrder={updateOrder}
          onOpenOrder={(id) => setOpenOrderId(id)}
        />
      )} {" "}
      {createProductOpen && (
        <CreateProductModal
          availableTags={productTagOptions}
          onClose={() => setCreateProductOpen(false)}
          onCreated={() => {
            setCreateProductOpen(false);
            setNotice("Product created successfully.");
            void load();
          }}
        />
      )}
      {testOrderOpen && (
        <AdminTestOrderModal
          products={data.products}
          onClose={() => setTestOrderOpen(false)}
          onCreated={(message) => {
            setTestOrderOpen(false);
            setNotice(message);
            void load();
          }}
        />
      )}
      {openOrderId && (
        <AdminOrderDetailModal id={openOrderId} onClose={() => setOpenOrderId(null)} />
      )}
    </main>
  );
}

function CreateProductModal({
  availableTags,
  onClose,
  onCreated,
}: {
  availableTags: string[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    title: "",
    handle: "",
    description: "",
    price: "",
    compareAtPrice: "",
    inventoryQuantity: "10",
    status: "active",
    available: true,
    productType: "Succulent",
    careLevel: "Easy",
    indoorOutdoor: "Indoor",
    tags: "",
    collections: "",
    image: "",
    images: [] as string[],
    imageAlt: "",
    vendor: "Succulent Sphere",
  });
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function save() {
    setBusy(true);
    setNotice("");
    try {
      const data = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (key === "images") return;
        if (value !== null && value !== undefined) data.append(key, String(value));
      });
      const images = normalizeImageList(form.images);
      if (images.length) data.append("images", images.join(","));
      imageFiles.forEach((file) => data.append("imageFiles", file));
      if (form.image) data.append("image", form.image);

      const response = await fetch("/api/admin/products", {
        method: "POST",
        body: data,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to create product.");
      onCreated();
    } catch (error) {
      setNotice((error as Error).message || "Unable to create product.");
    } finally {
      setBusy(false);
    }
  }

  const field = "mt-1 w-full rounded-xl border border-[#d7e0d9] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6f9878]";

  return (
    <Modal title="Add new product" onClose={onClose}>
      <div className="grid gap-5 p-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-5">
          <section className="rounded-2xl border bg-white p-4">
            <h3 className="font-semibold">Product details</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label>
                Title
                <input className={field} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value, handle: e.target.value ? e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") : "" })} />
              </label>
              <label>
                Handle
                <input className={field} value={form.handle} onChange={(e) => setForm({ ...form, handle: e.target.value })} />
              </label>
            </div>
            <label className="mt-3 block">
              Description
              <textarea rows={6} className={field} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>
          </section>

          <section className="rounded-2xl border bg-white p-4">
            <h3 className="font-semibold">Pricing & inventory</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label>
                Price (₹)
                <input type="number" min="0" step="0.01" className={field} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </label>
              <label>
                Compare-at (₹)
                <input type="number" min="0" step="0.01" className={field} value={form.compareAtPrice} onChange={(e) => setForm({ ...form, compareAtPrice: e.target.value })} />
              </label>
              <label>
                Inventory
                <input type="number" min="0" className={field} value={form.inventoryQuantity} onChange={(e) => setForm({ ...form, inventoryQuantity: e.target.value })} />
              </label>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label>
                Status
                <select className={field} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                  <option value="unlisted">Unlisted</option>
                  <option value="sold out">Sold out</option>
                </select>
              </label>
              <label className="flex items-center gap-2 pt-7 text-sm">
                <input type="checkbox" checked={form.available} onChange={(e) => setForm({ ...form, available: e.target.checked })} />
                Available for sale
              </label>
            </div>
          </section>

          <section className="rounded-2xl border bg-white p-4">
            <h3 className="font-semibold">Store classification</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label>
                Product type
                <input className={field} value={form.productType} onChange={(e) => setForm({ ...form, productType: e.target.value })} />
              </label>
              <label>
                Care level
                <input className={field} value={form.careLevel} onChange={(e) => setForm({ ...form, careLevel: e.target.value })} />
              </label>
              <label>
                Indoor / outdoor
                <input className={field} value={form.indoorOutdoor} onChange={(e) => setForm({ ...form, indoorOutdoor: e.target.value })} />
              </label>
              <label>
                Vendor
                <input className={field} value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
              </label>
              <label className="sm:col-span-2">
                Tags
                <input
                  list="product-tag-options"
                  className={field}
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  placeholder="best seller, indoor, beginner-friendly"
                />
                <datalist id="product-tag-options">
                  {availableTags.map((tag) => (
                    <option key={tag} value={tag} />
                  ))}
                </datalist>
              </label>
              <label className="sm:col-span-2">
                Collections
                <input className={field} value={form.collections} onChange={(e) => setForm({ ...form, collections: e.target.value })} placeholder="succulents, office-plants" />
              </label>
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-2xl border bg-white p-4">
            <h3 className="font-semibold">Media</h3>
            <div className="mt-3 rounded-xl border border-dashed border-[#c9d5cb] bg-[#f7faf6] p-3">
              <label className="block text-sm font-medium text-[#35543f]">Upload image files</label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setImageFiles(Array.from(e.target.files || []))}
                className="mt-2 block w-full text-sm text-[#35543f] file:mr-3 file:rounded-xl file:border-0 file:bg-[#24563e] file:px-3 file:py-2 file:text-sm file:font-bold file:text-white"
              />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {normalizeImageList(form.images).map((url: string, index: number) => (
                <button
                  key={`${url}-${index}`}
                  type="button"
                  onClick={() => setForm({ ...form, image: url })}
                  className={`overflow-hidden rounded-lg border ${form.image === url ? "border-[#24563e] ring-2 ring-[#dfece2]" : "border-[#d7e0d9]"}`}
                >
                  <img src={url} alt="Product preview" className="h-16 w-full object-cover" />
                </button>
              ))}
            </div>
            <label className="mt-3 block">
              Or use image URL
              <input className={field} value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value, images: normalizeImageList([e.target.value, ...(form.images || [])]) })} placeholder="https://..." />
            </label>
            <label className="mt-3 block">
              Gallery URLs
              <input className={field} value={normalizeImageList(form.images).join(", ")} onChange={(e) => {
                const nextImages = normalizeImageList(e.target.value);
                setForm({ ...form, images: nextImages, image: nextImages[0] || form.image || "" });
              }} placeholder="https://..., https://..." />
            </label>
            <label className="mt-3 block">
              Alt text
              <input className={field} value={form.imageAlt} onChange={(e) => setForm({ ...form, imageAlt: e.target.value })} />
            </label>
          </section>
        </aside>
      </div>

      {notice && <p className="px-5 pb-2 text-sm text-rose-700">{notice}</p>}
      <footer className="sticky bottom-0 flex justify-end gap-3 border-t bg-white p-4">
        <button type="button" onClick={onClose} className="rounded-xl border px-4 py-2 text-sm font-bold">Cancel</button>
        <button type="button" disabled={busy} onClick={save} className="rounded-xl bg-[#24563e] px-4 py-2 text-sm font-bold text-white">
          {busy ? "Creating…" : "Create product"}
        </button>
      </footer>
    </Modal>
  );
}

function Overview({
  data,
  onGo,
}: {
  data: Data;
  onGo: (tab: "products" | "orders" | "customers" | "reviews") => void;
}) {
  const cards = [
    ["Paid revenue", inr(data.summary.paidRevenue), CircleDollarSign, "orders"],
    ["Orders", data.summary.orders, ClipboardList, "orders"],
    ["Products", data.summary.products, Package, "products"],
    ["Customers", data.summary.customers, Users, "customers"],
    ["Low stock", data.summary.lowStock, Sparkles, "products"],
    ["Reviews", data.summary.reviews, Star, "reviews"],
  ] as const;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map(([label, value, Icon, target], index) => (
        <button
          key={label}
          onClick={() => onGo(target)}
          className="group relative overflow-hidden rounded-[25px] border border-white/90 bg-white p-5 text-left shadow-[12px_14px_24px_rgba(65,84,70,.14)] transition hover:-translate-y-1"
        >
          <div
            className={`absolute right-0 top-0 h-20 w-20 rounded-bl-[70px] ${index % 2 ? "bg-[#e8bf92]" : "bg-[#c9dfc9]"}`}
          />
          <Icon className="relative text-[#296046]" size={22} />
          <p className="relative mt-7 text-3xl font-bold">{value}</p>
          <p className="relative mt-1 text-sm text-[#68776d]">{label}</p>
        </button>
      ))}
    </div>
  );
}
function Products({
  rows,
  selected,
  setSelected,
  bulk,
  setBulk,
  save,
  busy,
  open,
  onCreateNew,
  priceSort,
  setPriceSort,
}: any) {
  const all =
    rows.length > 0 &&
    rows.every((item: Product) => selected.includes(item.id));
  const toggle = (id: string) =>
    setSelected((current: string[]) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  return (
    <div className="overflow-hidden rounded-[26px] border border-white bg-white shadow-[12px_14px_24px_rgba(65,84,70,.13)]">
       <div className="flex flex-wrap items-center gap-3 border-b bg-[#f5f8f4] p-4">
        <label className="flex items-center gap-2 text-xs font-bold text-[#526257]">
          Sort
          <select
            value={priceSort}
            onChange={(event) => setPriceSort(event.target.value)}
            className="rounded-xl border bg-white px-3 py-2 text-xs font-semibold text-[#243129]"
            aria-label="Sort products by price"
          >
            <option value="default">Default order</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
          </select>
        </label>
        <button
          onClick={() =>
            setSelected(all ? [] : rows.map((item: Product) => item.id))
          }
          className="rounded-xl border bg-white px-3 py-2 text-xs font-bold"
        >
          {all ? "Clear selection" : "Select all"}
        </button>
        <button
          onClick={onCreateNew}
          className="rounded-xl bg-[#24563e] px-3 py-2 text-xs font-bold text-white"
        >
          Add new product
        </button>
        <span className="text-sm font-semibold text-[#617366]">
          {selected.length} selected
        </span>
        {selected.length > 0 && (
          <button
            onClick={save}
            disabled={busy}
            className="ml-auto rounded-xl bg-[#24563e] px-4 py-2 text-xs font-bold text-white"
          >
            Apply bulk changes
          </button>
        )}
      </div>
      {selected.length > 0 && (
        <div className="grid gap-2 border-b bg-[#eef6ed] p-4 sm:grid-cols-2 xl:grid-cols-5">
          <input
            value={bulk.price}
            onChange={(e) => setBulk({ ...bulk, price: e.target.value })}
            placeholder="Price (₹)"
            type="number"
            className="rounded-xl border p-2 text-sm"
          />
          <input
            value={bulk.inventoryQuantity}
            onChange={(e) =>
              setBulk({ ...bulk, inventoryQuantity: e.target.value })
            }
            placeholder="Inventory"
            type="number"
            className="rounded-xl border p-2 text-sm"
          />
          <select
            value={bulk.status}
            onChange={(e) => setBulk({ ...bulk, status: e.target.value })}
            className="rounded-xl border p-2 text-sm"
          >
            <option value="">Status</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
            <option value="unlisted">Unlisted</option>
          </select>
          <select
            value={bulk.available}
            onChange={(e) => setBulk({ ...bulk, available: e.target.value })}
            className="rounded-xl border p-2 text-sm"
          >
            <option value="">Availability</option>
            <option value="true">Available</option>
            <option value="false">Unavailable</option>
          </select>
          <input
            value={bulk.tags}
            onChange={(e) => setBulk({ ...bulk, tags: e.target.value })}
            placeholder="Tags: comma separated"
            className="rounded-xl border p-2 text-sm"
          />
        </div>
      )}
      <div className="max-h-[650px] overflow-auto">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="sticky top-0 bg-white text-[10px] uppercase tracking-wider text-[#78887d]">
            <tr>
              <th className="p-4" />
              <th className="p-4">Product</th>
              <th className="p-4">Price</th>
              <th className="p-4">Stock</th>
              <th className="p-4">Status</th>
              <th className="p-4">Tags</th>
              <th className="p-4" />
            </tr>
          </thead>
          <tbody>
            {rows.map((item: Product) => (
              <tr
                key={item.id}
                className="border-t border-[#edf0ed] hover:bg-[#f8fbf7]"
              >
                <td className="p-4">
                  <input
                    type="checkbox"
                    checked={selected.includes(item.id)}
                    onChange={() => toggle(item.id)}
                  />
                </td>
                <td className="p-4">
                  <button
                    onClick={() => open(item.id)}
                    className="flex items-center gap-3 text-left"
                  >
                    <img
                      src={item.image || "/assets/product-1.jpg"}
                      alt=""
                      className="h-11 w-11 rounded-xl object-cover shadow"
                    />
                    <span>
                      <span className="block font-bold">{item.title}</span>
                      <span className="text-xs text-[#718076]">
                        {item.handle}
                      </span>
                    </span>
                  </button>
                </td>
                <td className="p-4 font-semibold">{inr(item.price)}</td>
                <td className="p-4">
                  <span
                    className={
                      item.inventoryQuantity <= 10
                        ? "font-bold text-rose-600"
                        : ""
                    }
                  >
                    {item.inventoryQuantity}
                  </span>
                </td>
                <td className="p-4">
                  <Status
                    tone={
                      item.available && item.status === "active"
                        ? "green"
                        : "stone"
                    }
                  >
                    {item.status}
                  </Status>
                </td>
                <td className="p-4 text-xs text-[#718076]">
                  {item.tags.join(", ") || "—"}
                </td>
                <td className="p-4">
                  <button
                    onClick={() => open(item.id)}
                    className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-bold"
                  >
                    <Pencil size={13} />
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function Orders({
  rows,
  update,
  busy,
  onCreateTest,
  onOpenOrder,
}: {
  rows: Order[];
  update: (order: Order) => void;
  busy: boolean;
  onCreateTest: () => void;
  onOpenOrder?: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={onCreateTest}
          className="rounded-xl bg-[#24563e] px-4 py-2 text-sm font-bold text-white"
        >
          Create test order
        </button>
      </div>
      <OrderTable rows={rows} update={update} busy={busy} onOpenOrder={onOpenOrder} />
    </div>
  );
}
function OrderTable({
  rows,
  update,
  busy,
  onOpenOrder,
}: {
  rows: Order[];
  update: (order: Order) => void;
  busy: boolean;
  onOpenOrder?: (id: string) => void;
}) {
  const router = useRouter();

  return (
    <div className="overflow-hidden rounded-[26px] border border-white bg-white shadow-[12px_14px_24px_rgba(65,84,70,.13)]">
      <div className="max-h-[700px] overflow-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="sticky top-0 bg-white text-[10px] uppercase tracking-wider text-[#78887d]">
            <tr>
              <th className="p-4">Order</th>
              <th className="p-4">Customer</th>
              <th className="p-4">Payment</th>
              <th className="p-4">Fulfillment</th>
              <th className="p-4">Email</th>
              <th className="p-4" />
            </tr>
          </thead>
          <tbody>
            {rows.map((order) => (
              <tr
                key={order.id}
                onClick={() => router.push(`/admin/orders/${encodeURIComponent(String(order.id || ""))}`)}
                className="cursor-pointer border-t border-[#edf0ed] hover:bg-[#f8fbf7]"
              >
                <td className="p-4">
                  <p className="font-bold">#{order.orderNumber || "—"}</p>
                  <p className="text-xs text-[#718076]">
                    {date(order.createdAt)} · {inr(order.total)}
                  </p>
                </td>
                <td className="p-4">
                  <p className="font-semibold">{order.customerName}</p>
                  <p className="text-xs text-[#718076]">{order.email}</p>
                </td>
                <td className="p-4">
                  {(() => {
                    const label = order.financialStatus === "DEPOSIT_PAID" ? "COD (partial paid)" : order.financialStatus;
                    return (
                      <Status tone={order.financialStatus === "PAID" ? "green" : "amber"}>
                        {label}
                      </Status>
                    );
                  })()}
                </td>
                <td className="p-4">
                  <Status
                    tone={
                      order.fulfillmentStatus === "DELIVERED"
                        ? "green"
                        : order.fulfillmentStatus === "CANCELLED"
                          ? "red"
                          : "stone"
                    }
                  >
                    {order.fulfillmentStatus}
                  </Status>
                </td>
                <td className="p-4">
                  <Status
                    tone={
                      order.emailStatus === "sent"
                        ? "green"
                        : order.emailStatus === "failed"
                          ? "red"
                          : "amber"
                    }
                  >
                    {order.emailStatus}
                  </Status>
                </td>
                <td className="p-4">
                  <button
                    disabled={busy}
                    onClick={(e) => { e.stopPropagation(); update(order); }}
                    className="rounded-xl border bg-white px-3 py-2 text-xs font-bold"
                  >
                    Update
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td
                  colSpan={6}
                  className="p-8 text-center text-sm text-[#718076]"
                >
                  No orders found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function Customers({
  rows,
  onEmail,
  open,
}: {
  rows: Customer[];
  onEmail: (email: string) => void;
  open: (id: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-[26px] border border-white bg-white shadow-[12px_14px_24px_rgba(65,84,70,.13)]">
      <div className="max-h-[700px] overflow-auto">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="sticky top-0 bg-white text-[10px] uppercase tracking-wider text-[#78887d]">
            <tr>
              <th className="p-4">Customer</th>
              <th className="p-4">Phone</th>
              <th className="p-4">Joined</th>
              <th className="p-4">Wishlist</th>
              <th className="p-4" />
            </tr>
          </thead>
          <tbody>
            {rows.map((customer) => (
              <tr
                key={customer.id}
                className="border-t border-[#edf0ed] hover:bg-[#f8fbf7]"
              >
                <td className="p-4">
                  <button
                    onClick={() => open(customer.id)}
                    className="text-left"
                  >
                    <span className="block font-bold">
                      {customer.name || "Unnamed customer"}
                    </span>
                    <span className="text-xs text-[#718076]">
                      {customer.email}
                    </span>
                  </button>
                </td>
                <td className="p-4">{customer.phone || "—"}</td>
                <td className="p-4">{date(customer.createdAt)}</td>
                <td className="p-4">{customer.wishlistCount}</td>
                <td className="p-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => open(customer.id)}
                      className="rounded-xl border px-3 py-2 text-xs font-bold"
                    >
                      Details
                    </button>
                    <button
                      onClick={() => onEmail(customer.email)}
                      className="rounded-xl border bg-white px-3 py-2 text-xs font-bold"
                    >
                      Email
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function Reviews({
  rows,
  update,
}: {
  rows: Review[];
  update: (id: string, status: string) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {rows.map((review) => (
        <article
          key={review.id}
          className="rounded-[24px] border border-white bg-white p-5 shadow-[10px_12px_20px_rgba(65,84,70,.13)]"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-bold">{review.authorName}</p>
              <p className="text-xs text-[#718076]">
                {review.productId} · {date(review.createdAt)}
              </p>
            </div>
            <Status tone={review.status === "published" ? "green" : "stone"}>
              {review.status}
            </Status>
          </div>
          <p className="mt-4 text-amber-500">
            {"★".repeat(Math.max(1, Math.min(5, review.rating)))}
          </p>
          <p className="mt-2 font-semibold">{review.title || "Review"}</p>
          <p className="mt-1 line-clamp-3 text-sm text-[#596b5f]">
            {review.content}
          </p>
          <button
            onClick={() =>
              update(
                review.id,
                review.status === "published" ? "hidden" : "published",
              )
            }
            className="mt-4 rounded-xl border px-3 py-2 text-xs font-bold"
          >
            {review.status === "published" ? "Hide review" : "Publish review"}
          </button>
        </article>
      ))}
    </div>
  );
}
function MailComposer({ mail, setMail, send, busy }: any) {
  return (
    <div className="mx-auto max-w-3xl rounded-[30px] border border-white bg-white p-6 shadow-[14px_18px_30px_rgba(65,84,70,.16)]">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-[#d8ead8] p-3 text-[#235439]">
          <Send size={22} />
        </div>
        <div>
          <h3 className="font-serif text-2xl">Send customer email</h3>
          <p className="text-sm text-[#718076]">
            Uses your configured Resend sender address.
          </p>
        </div>
      </div>
      <div className="mt-6 space-y-4">
        <input
          value={mail.to}
          onChange={(e) => setMail({ ...mail, to: e.target.value })}
          placeholder="Customer email"
          type="email"
          className="w-full rounded-2xl border p-3 text-sm outline-none focus:ring-2"
        />
        <input
          value={mail.subject}
          onChange={(e) => setMail({ ...mail, subject: e.target.value })}
          placeholder="Subject"
          className="w-full rounded-2xl border p-3 text-sm outline-none focus:ring-2"
        />
        <textarea
          value={mail.message}
          onChange={(e) => setMail({ ...mail, message: e.target.value })}
          placeholder="Write your message…"
          rows={9}
          className="w-full rounded-2xl border p-3 text-sm outline-none focus:ring-2"
        />
        <button
          onClick={send}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-2xl bg-[#24563e] px-5 py-3 text-sm font-bold text-white"
        >
          <Send size={15} />
          Send email
        </button>
      </div>
    </div>
  );
}
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-[#102419]/55 p-3 backdrop-blur-sm sm:p-8">
      <div className="mx-auto min-h-full max-w-5xl">
        <section
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="rounded-[28px] bg-[#f7f9f5] shadow-2xl"
        >
          <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[#dce5dc] bg-white/95 px-5 py-4 backdrop-blur">
            <h2 className="font-serif text-2xl">{title}</h2>
            <button
              onClick={onClose}
              className="rounded-xl p-2 hover:bg-stone-100"
              aria-label="Close"
            >
              <X />
            </button>
          </header>
          {children}
        </section>
      </div>
    </div>
  );
}
function ProductEditor({
  id,
  availableTags,
  onClose,
  onSaved,
}: {
  id: string;
  availableTags: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [data, setData] = useState<ProductResponse | null>(null);
  const [form, setForm] = useState<any>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [newImageFiles, setNewImageFiles] = useState<File[]>([]);
  const [reviewDraft, setReviewDraft] = useState({ authorName: "", authorEmail: "", title: "", content: "", rating: 5, verifiedPurchase: false });
  useEffect(() => {
    fetch(`/api/admin/products/${encodeURIComponent(id)}`)
      .then(async (r) => {
        const p = await r.json();
        if (!r.ok) throw new Error(p.error);
        setData(p);
        const productImages = normalizeImageList(
          p.product.images && p.product.images.length
            ? p.product.images
            : p.product.image
              ? [p.product.image]
              : [],
        );
        setForm({
          ...p.product,
          image: p.product.image || productImages[0] || "",
          images: productImages,
          tags: p.product.tags.join(", "),
          collections: p.product.collections.join(", "),
        });
      })
      .catch((e) => setNotice(e.message));
  }, [id]);
  const save = async () => {
    setBusy(true);
    try {
      const imageFiles = newImageFiles.length ? newImageFiles : [];
      let requestBody: BodyInit;
      let requestHeaders: HeadersInit | undefined;

      if (imageFiles.length) {
        const formData = new FormData();
        Object.entries(form).forEach(([key, value]) => {
          if (key === "images") return;
          if (value !== null && value !== undefined && value !== "") formData.append(key, String(value));
        });
        formData.append("images", normalizeImageList(form.images).join(","));
        imageFiles.forEach((file) => formData.append("imageFiles", file));
        requestBody = formData;
      } else {
        requestBody = JSON.stringify({
          ...form,
          image: form.image || normalizeImageList(form.images)[0] || "",
          images: normalizeImageList(form.images),
          tags: toList(form.tags),
          collections: toList(form.collections),
        });
        requestHeaders = { "Content-Type": "application/json" };
      }

      const response = await fetch(
        `/api/admin/products/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: requestHeaders,
          body: requestBody,
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save product.");
      onSaved();
      onClose();
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const reviewStatus = async (reviewId: string, status: string) => {
    const response = await fetch("/api/admin/reviews", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: reviewId, status }),
    });
    const payload = await response.json();
    if (!response.ok)
      return setNotice(payload.error || "Unable to update review.");
    setData((current) =>
      current
        ? {
            ...current,
            reviews: current.reviews.map((r) =>
              r.id === reviewId ? { ...r, status } : r,
            ),
          }
        : current,
    );
  };
  const addReview = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: id, ...reviewDraft, status: "published" }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to add review.");
      setData((current) => current ? { ...current, reviews: [{ id: payload.id, productId: id, authorName: reviewDraft.authorName || "Store team", title: reviewDraft.title, content: reviewDraft.content, rating: reviewDraft.rating, status: "published", createdAt: new Date().toISOString(), verifiedPurchase: reviewDraft.verifiedPurchase }, ...current.reviews] } : current);
      setReviewDraft({ authorName: "", authorEmail: "", title: "", content: "", rating: 5, verifiedPurchase: false });
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (!form)
    return (
      <Modal title="Product details" onClose={onClose}>
        <p className="p-6 text-sm">{notice || "Loading product…"}</p>
      </Modal>
    );
  const input =
    "mt-1 w-full rounded-xl border border-[#d7e0d9] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#6f9878]";
  const galleryImages = normalizeImageList(form.images);
  const primaryImage = form.image || galleryImages[0] || "";

  return (
    <Modal title={`Edit ${form.title}`} onClose={onClose}>
      <div className="grid gap-5 p-5 lg:grid-cols-[1.25fr_.75fr]">
        <div className="space-y-5">
          <section className="rounded-2xl border bg-white p-4">
            <h3 className="font-semibold">Product information</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label>
                Title
                <input
                  className={input}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </label>
              <label>
                Handle
                <input
                  className={input}
                  value={form.handle}
                  onChange={(e) => setForm({ ...form, handle: e.target.value })}
                />
              </label>
            </div>
            <label className="mt-3 block">
              Description
              <textarea
                className={input}
                rows={8}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </label>
          </section>
          <section className="rounded-2xl border bg-white p-4">
            <h3 className="font-semibold">Pricing & inventory</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label>
                Price
                <input
                  type="number"
                  min="0"
                  className={input}
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </label>
              <label>
                Compare-at price
                <input
                  type="number"
                  min="0"
                  className={input}
                  value={form.compareAtPrice ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, compareAtPrice: e.target.value })
                  }
                />
              </label>
              <label>
                Stock
                <input
                  type="number"
                  min="0"
                  className={input}
                  value={form.inventoryQuantity}
                  onChange={(e) =>
                    setForm({ ...form, inventoryQuantity: e.target.value })
                  }
                />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-4">
              <label>
                Status
                <select
                  className={input}
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                  <option value="unlisted">Unlisted</option>
                  <option value="sold out">Sold out</option>
                </select>
              </label>
              <label className="flex items-end gap-2 pb-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.available}
                  onChange={(e) =>
                    setForm({ ...form, available: e.target.checked })
                  }
                />{" "}
                Available for sale
              </label>
            </div>
          </section>
          <section className="rounded-2xl border bg-white p-4">
            <h3 className="font-semibold">Organization & storefront</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label>
                Tags
                <input
                  list="product-tag-options-editor"
                  className={input}
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                />
                <datalist id="product-tag-options-editor">
                  {availableTags.map((tag) => (
                    <option key={tag} value={tag} />
                  ))}
                </datalist>
              </label>
              <label>
                Collections
                <input
                  className={input}
                  value={form.collections}
                  onChange={(e) =>
                    setForm({ ...form, collections: e.target.value })
                  }
                />
              </label>
              <label>
                Product type
                <input
                  className={input}
                  value={form.productType}
                  onChange={(e) =>
                    setForm({ ...form, productType: e.target.value })
                  }
                />
              </label>
              <label>
                Vendor
                <input
                  className={input}
                  value={form.vendor}
                  onChange={(e) => setForm({ ...form, vendor: e.target.value })}
                />
              </label>
              <label>
                Care level
                <input
                  className={input}
                  value={form.careLevel}
                  onChange={(e) =>
                    setForm({ ...form, careLevel: e.target.value })
                  }
                />
              </label>
              <label>
                Indoor/outdoor
                <input
                  className={input}
                  value={form.indoorOutdoor}
                  onChange={(e) =>
                    setForm({ ...form, indoorOutdoor: e.target.value })
                  }
                />
              </label>
            </div>
          </section>
          <section className="rounded-2xl border bg-white p-4">
            <h3 className="font-semibold">Search engine listing</h3>
            <label className="mt-3 block">
              SEO title
              <input
                className={input}
                value={form.seoTitle}
                onChange={(e) => setForm({ ...form, seoTitle: e.target.value })}
              />
            </label>
            <label className="mt-3 block">
              SEO description
              <textarea
                className={input}
                rows={3}
                value={form.seoDescription}
                onChange={(e) =>
                  setForm({ ...form, seoDescription: e.target.value })
                }
              />
            </label>
          </section>
        </div>
        <aside className="space-y-5">
          <section className="rounded-2xl border bg-white p-4">
            <h3 className="font-semibold">Media</h3>
            {primaryImage ? (
              <img
                src={primaryImage}
                alt=""
                className="mt-3 aspect-square w-full rounded-xl object-cover"
              />
            ) : null}
            <div className="mt-3 grid grid-cols-3 gap-2">
              {galleryImages.length ? (
                galleryImages.map((url: string, index: number) => (
                  <button
                    key={`${url}-${index}`}
                    type="button"
                    onClick={() => setForm({ ...form, image: url, images: galleryImages })}
                    className={`overflow-hidden rounded-lg border ${primaryImage === url ? "border-[#24563e] ring-2 ring-[#dfece2]" : "border-[#d7e0d9]"}`}
                  >
                    <img src={url} alt="Product thumbnail" className="h-20 w-full object-cover" />
                  </button>
                ))
              ) : (
                <p className="col-span-3 text-xs text-[#617366]">No gallery images yet.</p>
              )}
            </div>
            <label className="mt-3 block">
              Main image URL
              <input
                className={input}
                value={form.image}
                onChange={(e) => {
                  const updated = e.target.value.trim();
                  const nextImages = normalizeImageList([
                    updated,
                    ...galleryImages.filter((url: string) => url !== updated),
                  ]);
                  setForm({ ...form, image: updated, images: nextImages });
                }}
              />
            </label>
            <label className="mt-3 block">
              Extra image URLs
              <input
                className={input}
                value={galleryImages.join(", ")}
                onChange={(e) => {
                  const nextImages = normalizeImageList(e.target.value);
                  setForm({ ...form, image: nextImages[0] || form.image || "", images: nextImages });
                }}
              />
            </label>
            <label className="mt-3 block">
              Add product image files
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setNewImageFiles(Array.from(e.target.files || []))}
                className="mt-1 block w-full text-sm text-[#35543f] file:mr-3 file:rounded-xl file:border-0 file:bg-[#24563e] file:px-3 file:py-2 file:text-sm file:font-bold file:text-white"
              />
            </label>
            <label className="mt-3 block">
              Alt text
              <input
                className={input}
                value={form.imageAlt}
                onChange={(e) => setForm({ ...form, imageAlt: e.target.value })}
              />
            </label>
          </section>
          <section className="rounded-2xl border bg-white p-4">
            <h3 className="font-semibold">Product reviews ({data?.reviews.length || 0})</h3>
            <div className="mt-3 space-y-2 rounded-xl border border-[#d7e0d9] bg-[#f8fbf7] p-3 text-sm">
              <p className="font-semibold text-[#24563e]">Add a backend review</p>
              <div className="grid gap-2 sm:grid-cols-2"><input className="rounded-lg border bg-white px-2 py-1.5" placeholder="Reviewer name" value={reviewDraft.authorName} onChange={(event) => setReviewDraft({ ...reviewDraft, authorName: event.target.value })}/><input className="rounded-lg border bg-white px-2 py-1.5" placeholder="Reviewer email (optional)" value={reviewDraft.authorEmail} onChange={(event) => setReviewDraft({ ...reviewDraft, authorEmail: event.target.value })}/><input className="rounded-lg border bg-white px-2 py-1.5" placeholder="Review title" value={reviewDraft.title} onChange={(event) => setReviewDraft({ ...reviewDraft, title: event.target.value })}/><select className="rounded-lg border bg-white px-2 py-1.5" value={reviewDraft.rating} onChange={(event) => setReviewDraft({ ...reviewDraft, rating: Number(event.target.value) })}>{[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating} star{rating === 1 ? "" : "s"}</option>)}</select></div>
              <textarea className="w-full rounded-lg border bg-white px-2 py-1.5" rows={3} placeholder="Write the review" value={reviewDraft.content} onChange={(event) => setReviewDraft({ ...reviewDraft, content: event.target.value })}/>
              <div className="flex items-center justify-between gap-2"><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={reviewDraft.verifiedPurchase} onChange={(event) => setReviewDraft({ ...reviewDraft, verifiedPurchase: event.target.checked })}/> Verified purchase</label><button type="button" disabled={busy || !reviewDraft.content.trim()} onClick={addReview} className="rounded-lg bg-[#24563e] px-3 py-1.5 text-xs font-bold text-white">Add review</button></div>
            </div>
            <div className="mt-3 space-y-3">
              {data?.reviews.map((review) => (
                <article
                  key={review.id}
                  className="rounded-xl bg-[#f5f8f4] p-3 text-sm"
                >
                  <div className="flex justify-between gap-2">
                    <span className="font-semibold">{review.authorName}</span>
                    <Status
                      tone={review.status === "published" ? "green" : "stone"}
                    >
                      {review.status}
                    </Status>
                  </div>
                  <p className="mt-1 text-amber-500">
                    {"★".repeat(review.rating)}
                  </p>
                  <p className="mt-1">{review.title || "Review"}</p>
                  <p className="text-xs text-[#617366]">{review.content}</p>
                  <button
                    onClick={() =>
                      reviewStatus(
                        review.id,
                        review.status === "published" ? "hidden" : "published",
                      )
                    }
                    className="mt-2 text-xs font-bold text-[#24563e]"
                  >
                    {review.status === "published" ? "Hide" : "Publish"}
                  </button>
                </article>
              ))}
              {!data?.reviews.length && (
                <p className="text-sm text-[#718076]">No reviews yet.</p>
              )}
            </div>
          </section>
        </aside>
      </div>
      {notice && <p className="px-5 pb-3 text-sm text-rose-700">{notice}</p>}
      <footer className="sticky bottom-0 flex justify-end gap-3 border-t bg-white p-4">
        <button
          onClick={onClose}
          className="rounded-xl border px-4 py-2 text-sm font-bold"
        >
          Cancel
        </button>
        <button
          disabled={busy}
          onClick={save}
          className="rounded-xl bg-[#24563e] px-4 py-2 text-sm font-bold text-white"
        >
          {busy ? "Saving…" : "Save product"}
        </button>
      </footer>
    </Modal>
  );
}
function CustomerDetails({
  id,
  onClose,
  onEmail,
  updateOrder,
  onOpenOrder,
}: {
  id: string;
  onClose: () => void;
  onEmail: (email: string) => void;
  updateOrder: (order: Order) => void;
  onOpenOrder: (id: string) => void;
}) {
  const [data, setData] = useState<CustomerResponse | null>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    fetch(`/api/admin/customers/${encodeURIComponent(id)}`)
      .then(async (r) => {
        const p = await r.json();
        if (!r.ok) throw new Error(p.error);
        setData(p);
      })
      .catch((e) => setNotice(e.message));
  }, [id]);
  if (!data)
    return (
      <Modal title="Customer details" onClose={onClose}>
        <p className="p-6 text-sm">{notice || "Loading customer…"}</p>
      </Modal>
    );
  const { customer } = data;
  return (
    <Modal
      title={customer.displayName || customer.name || "Customer details"}
      onClose={onClose}
    >
      <div className="grid gap-5 p-5 lg:grid-cols-[.75fr_1.25fr]">
        <aside className="space-y-4">
          <section className="rounded-2xl border bg-white p-4">
            <p className="font-semibold">Contact</p>
            <p className="mt-3 font-bold">
              {customer.displayName || "Unnamed customer"}
            </p>
            <p className="text-sm text-[#617366]">{customer.email}</p>
            <p className="mt-1 text-sm text-[#617366]">
              {customer.phone || "No phone number"}
            </p>
            <button
              onClick={() => onEmail(customer.email)}
              className="mt-4 rounded-xl bg-[#24563e] px-3 py-2 text-xs font-bold text-white"
            >
              Email customer
            </button>
          </section>
          <section className="rounded-2xl border bg-white p-4">
            <p className="font-semibold">Customer profile</p>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-[#718076]">Joined</dt>
                <dd>{date(customer.createdAt)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#718076]">Wishlist</dt>
                <dd>{customer.wishlistProductIds.length} products</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#718076]">Orders</dt>
                <dd>{data.orders.length}</dd>
              </div>
            </dl>
          </section>
          <section className="rounded-2xl border bg-white p-4">
            <p className="font-semibold">Saved addresses</p>
            <div className="mt-3 space-y-3 text-sm">
              {data.addresses.map((address) => (
                <div key={address.id} className="rounded-xl bg-[#f5f8f4] p-3">
                  {[
                    address.address1,
                    address.address2,
                    address.city,
                    address.province,
                    address.zip,
                    address.country,
                  ]
                    .filter(Boolean)
                    .join(", ") || "Address details unavailable"}
                </div>
              ))}
              {!data.addresses.length && (
                <p className="text-[#718076]">No saved addresses.</p>
              )}
            </div>
          </section>
        </aside>
        <div className="space-y-5">
          <section>
          
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-serif text-xl">Orders</h3>
              <span className="text-sm text-[#718076]">
                {data.orders.length} total
              </span>
            </div>
            <OrderTable rows={data.orders} update={updateOrder} busy={false} onOpenOrder={onOpenOrder} />
          </section>
          <section className="rounded-2xl border bg-white p-4">
            <h3 className="font-serif text-xl">Reviews</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {data.reviews.map((review) => (
                <article
                  key={review.id}
                  className="rounded-xl bg-[#f5f8f4] p-3 text-sm"
                >
                  <p className="text-amber-500">
                    {"★".repeat(Math.max(1, review.rating))}
                  </p>
                  <p className="font-semibold">{review.title || "Review"}</p>
                  <p className="text-xs text-[#617366]">{review.content}</p>
                </article>
              ))}
              {!data.reviews.length && (
                <p className="text-sm text-[#718076]">
                  No reviews written by this customer.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </Modal>
  );
}
