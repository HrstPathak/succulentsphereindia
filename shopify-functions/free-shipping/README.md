# Free Shipping by Tag (Shopify Function)

This is a **shipping discount** Shopify Function that makes all shipping rates free
whenever **any cart line's product** has a tag matching `free_shipping` (case-insensitive).

## How it works
- Uses the **Discount Function API** with the `cart.delivery-options.discounts.generate.run` target.
- Checks `product.hasAnyTag` for `free_shipping` (includes case variants).
- Applies a **100% shipping discount** across all delivery groups.

## How to use
1. Create a Shopify app (or use an existing one) and add this folder under `extensions/free-shipping`.
2. Generate the function schema:
   - `shopify app function schema`
3. Build and deploy the app with Shopify CLI.
4. Create an **automatic discount** tied to this function (shipping class enabled).

## Notes
- This uses the **Discount Function API** shipping target, so it works with Shopify checkout in headless flows.
- Tags are matched using `hasAnyTag` with multiple case variants to ensure case-insensitive behavior.
