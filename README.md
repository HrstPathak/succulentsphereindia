# Succulent Sphere — Next.js Storefront

Premium D2C ecommerce storefront built with Next.js, TypeScript, Tailwind CSS,
Firebase, Razorpay, and Delhivery.

## Getting started

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local` and configure the required providers.
3. Run the development server: `npm run dev`

Core environment groups are Firebase, Razorpay, transactional email, admin
email allowlisting, Delhivery, media hosting, and optional Redis/Vercel KV.

## Delhivery shipping

Official API reference: https://delhivery-express-api-doc.readme.io/

1. Copy the Delhivery block from `.env.example` into `.env.local`.
2. Set `DELHIVERY_API_TOKEN` and choose server mode with
   `DELHIVERY_MODE=production` (or `staging`). This mode is authoritative.
   `DELHIVERY_CREATE_URL` is only a compatibility override when the mode is
   absent. The registered client and pickup values are fixed in code.
3. Open an order from the admin dashboard. **Ready to Ship** is the default
   destination under the Delhivery shipment panel.
4. The button rechecks serviceability and creates the AWB immediately. The AWB
   is saved to both the order and durable Firestore shipment job, and tracking is
   emailed to the customer. Existing AWBs are reconciled without a carrier call,
   preventing duplicate shipments.
5. The integration uses the confirmed shipment details already stored for the
   order. Its starting defaults are 14 × 12 × 12 cm and 450 g.

A paid order creates a durable Firestore shipment job. The admin's **Create Ready
to Ship** action rechecks serviceability before create, persists the AWB in both
`orders/{orderId}` and `shipments/{orderId}`, and sends tracking email. A confirmed
AWB always short-circuits future create/retry actions. Pending AWB is not exposed
because this repository has no Shopify Admin integration or credentials.

Delhivery does not document a supported client-dashboard prefill URL or
downloadable-label endpoint, so the application does not fabricate either.

## Verification

```bash
npm run delhivery:shipment:test
npx tsc --noEmit
npm run build
```
