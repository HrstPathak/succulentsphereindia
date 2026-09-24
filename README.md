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
2. Set the production API token, exact registered client name, registered pickup
   location/pincode, seller GSTIN, and HSN code. The pickup location name is
   case-sensitive and must match Delhivery exactly.
3. Open an order from the admin dashboard. The Delhivery workbench opens under
   **Create Delhivery Shipment**.
4. Verify the final packed box count, L/W/H, actual scale weight, recipient,
   payment mode, and fragile flag. The default 14 × 12 × 12 cm / 450 g values
   are only editable starting points.
5. Use one of these explicit paths:
   - **API automation:** save, check serviceability/rates, confirm, then create.
   - **Manual dashboard:** confirm, prepare the copy-ready handoff, create the
     shipment in Delhivery, then attach the returned AWB in the admin workbench.

A paid order creates only an `awaiting_details` shipment draft. It never
allocates an AWB automatically. API mode rechecks serviceability before create,
splits invoice/COD totals across multiple boxes, persists one AWB per box, and
sends the customer a tracking email. If a create response is uncertain or
partial, normal retry is blocked until the admin verifies Delhivery or attaches
the AWB manually.

Delhivery's public documentation does not define a supported client-dashboard
prefill URL or downloadable-label endpoint. Manual mode therefore provides a
structured handoff and dashboard link; use the dashboard's documented label
workflow after creating the AWB.

## Verification

```bash
npm run delhivery:shipment:test
npx tsc --noEmit
npm run build
```
