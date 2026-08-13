import { getFirebaseDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/admin-auth";
import AdminOrderTrackingForm from "@/components/admin/AdminOrderTrackingForm";
import AdminResendEmailButton from "@/components/admin/AdminResendEmailButton";
import AdminWhatsAppMessage from "@/components/admin/AdminWhatsAppMessage";

type Props = { params: { id?: string; order?: string } };

export default async function Page({ params }: Props) {
  await requireAdmin();
  const resolvedParams = await Promise.resolve(params as Props['params']);
  const id = String(resolvedParams?.id ?? resolvedParams?.order ?? "").trim();
  if (!id) return <div className="p-6">Order id required.</div>;
  const db = getFirebaseDb();
  const doc = await db.collection("orders").doc(id).get();
  if (!doc.exists) return <div className="p-6">Order not found.</div>;
  const order: any = doc.data();

  // compute COD metadata from line item custom attributes
  const codMeta = (() => {
    const items = Array.isArray(order.lineItems) ? order.lineItems : [];
    for (const item of items) {
      const attrs = Array.isArray(item.customAttributes) ? item.customAttributes : [];
      const paymentMode = attrs.find((a: any) => a.key === "payment_mode")?.value;
      if (paymentMode === "cod_deposit") {
        const depositRaw = attrs.find((a: any) => a.key === "cod_deposit")?.value || "100";
        const balanceRaw = attrs.find((a: any) => a.key === "cod_balance")?.value || "0";
        const deposit = Number(depositRaw) || 100;
        const balance = Number(balanceRaw) || 0;
        return { isCod: true, deposit, balance };
      }
    }
    return { isCod: false, deposit: 0, balance: 0 };
  })();
  const codCharge = codMeta.isCod ? 50 : 0;

  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-serif">Order #{order.orderNumber}</h1>
            <p className="text-sm text-gray-600">{new Date(order.createdAt).toLocaleString()}</p>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <article className="rounded-xl border bg-white p-4 shadow">
              <h2 className="mb-3 font-semibold">Items</h2>
              <ul className="space-y-3">
                {(order.lineItems || []).map((li: any) => (
                  <li key={li.id} className="flex items-start gap-4">
                    <img src={li.image || "/assets/product-1.jpg"} alt={li.title} className="h-20 w-20 rounded-xl object-cover" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium">{li.title}</h3>
                        <div className="font-semibold">{new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(Number(li.price?.amount||li.price||0))}</div>
                      </div>
                      <p className="text-sm text-gray-600">Quantity: {li.quantity}</p>
                      {li.variant && <p className="text-sm text-gray-600">Variant: {li.variant}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </article>

            <article className="rounded-xl border bg-white p-4 shadow">
              <h2 className="mb-3 font-semibold">Payment & Fulfillment</h2>
              <dl className="grid gap-2">
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-600">Payment mode</dt>
                  <dd className="font-medium">{order.paymentMode || order.payment_method || '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-600">Financial status</dt>
                  <dd className="font-medium">{order.financialStatus || order.financial_status}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-600">Fulfillment</dt>
                  <dd className="font-medium">{order.fulfillmentStatus || order.fulfillment_status}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-600">Tracking</dt>
                  <dd className="font-medium">{(order.tracking || []).map((t:any)=> t.number).join(', ') || '—'}</dd>
                </div>
              </dl>
              <AdminOrderTrackingForm id={doc.id} initialTracking={order.tracking || []} />
            </article>
          </div>

          <aside className="space-y-4">
            <article className="rounded-xl border bg-white p-4 shadow">
              <h2 className="mb-3 font-semibold">Customer</h2>
              <p className="font-medium">{order.customer?.fullName || order.customerName || order.name}</p>
              <p className="text-sm text-gray-600">{order.customer?.email || order.email}</p>
              <p className="text-sm text-gray-600">{order.customer?.phone || order.phone}</p>
              <div className="mt-3 text-sm">
                <p>Email status: <strong>{order.emailStatus || 'unknown'}</strong></p>
                {order.emailError && <p className="text-sm text-rose-600">Error: {String(order.emailError).slice(0,200)}</p>}
                <AdminResendEmailButton id={doc.id} />
                <AdminWhatsAppMessage
                  phone={order.customer?.phone || order.phone}
                  orderId={doc.id}
                  orderNumber={order.orderNumber}
                  items={(order.lineItems || []).map((li: any) => ({ title: li.title, quantity: li.quantity, price: (li.price && (li.price.amount || li.price)) || li.originalTotalPrice?.amount || li.discountedTotalPrice?.amount }))}
                  paymentMode={order.paymentMode || order.payment_method}
                  total={order.total || order.currentTotalPrice?.amount || order.totalPrice?.amount}
                  customerName={order.customer?.fullName || order.customerName || order.name}
                  createdAt={order.createdAt || order.processedAt || order.createdAt}
                  address={[(order.customer?.address || order.customer?.address1 || order.customer?.address_line1 || "").trim(), order.customer?.city, order.customer?.state || order.customer?.province, order.customer?.pincode || order.customer?.zip].filter(Boolean).join(", ")}
                  fulfillmentStatus={order.fulfillmentStatus || order.fulfillment_status}
                  trackingNumber={(order.tracking || [])[0]?.number}
                />
              </div>
            </article>

            <article className="rounded-xl border bg-white p-4 shadow">
              <h2 className="mb-3 font-semibold">Delivery address</h2>
              <div className="text-sm">
                <p className="font-medium">
                  {order.customer?.fullName || order.customerName || order.name || "—"}
                </p>
                <p className="mt-2">{(order.customer?.address || order.customer?.address1 || order.customer?.address_line1 || "").trim() || "—"}</p>
                {order.customer?.landmark ? (
                  <p className="text-sm text-gray-600">Landmark: {order.customer.landmark}</p>
                ) : null}
                <p className="text-sm text-gray-600">
                  {[
                    order.customer?.city,
                    order.customer?.state || order.customer?.province,
                    order.customer?.pincode || order.customer?.zip,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                {order.customer?.country && (
                  <p className="text-sm text-gray-600">{order.customer.country}</p>
                )}
                {order.customer?.phone && (
                  <p className="mt-2 text-sm text-gray-800">Phone: {order.customer.phone}</p>
                )}
              </div>
            </article>

            <article className="rounded-xl border bg-white p-4 shadow">
              <h2 className="mb-3 font-semibold">Totals</h2>
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span className="font-medium">{new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(Number(order.subtotal || order.sub_total || 0))}</span></div>
                <div className="flex justify-between"><span>Shipping</span><span className="font-medium">{new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(Number(order.shipping || order.shipping_total || 0))}</span></div>
                <div className="flex justify-between"><span>Tax</span><span className="font-medium">{new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(Number(order.tax || 0))}</span></div>
                {codMeta.isCod && (
                  <div className="flex justify-between"><span>COD Charge</span><span className="font-medium">{new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(Number(codCharge))}</span></div>
                )}
                <div className="flex justify-between text-lg"><span className="font-bold">Total</span><span className="font-bold">{new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(Number(order.total || 0))}</span></div>
              </div>
              {codMeta.isCod && codMeta.balance > 0 && (
                <p className="mt-3 text-sm text-[#6b766a]">Partial COD: deposit ₹{codMeta.deposit} received — balance ₹{codMeta.balance} due on delivery.</p>
              )}
            </article>
          </aside>
        </section>
      </div>
    </main>
  );
}
