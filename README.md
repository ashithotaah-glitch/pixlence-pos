# OmniPOS

Offline-ready POS, billing, inventory, and ecommerce sync foundation.

## What is included

- Browser-based POS billing screen with barcode scanner input.
- Product catalog with SKU, barcode, brand, category, price, tax, image, and stock.
- Inventory movements for receiving, adjustments, damage/write-off, and sales.
- Offline local persistence using `localStorage` for the first prototype.
- PWA shell with service worker cache for offline loading.
- Connector settings for WooCommerce, Shopify, Custom API, and SyncBot.
- Sync queue logs for future API integration.

## Run locally

```bash
cd /Users/ashit/Codex/omni-pos
python3 -m http.server 5174
```

Open `http://localhost:5174`.

## Barcode scanner behavior

Most USB/Bluetooth scanners work as keyboard input. Place focus in the barcode field, scan a barcode, and the scanner will usually type the value and press Enter. The POS finds the matching product by barcode or SKU and adds it to the cart.

## Production hosting target

Target domain: `https://pos.pixlencelabs.com`

The hosted app should use a backend API so ecommerce credentials are never exposed in browser JavaScript.

## Next backend phase

The frontend is intentionally connector-ready. The next phase should add:

- API backend with auth and user roles.
- PostgreSQL/MySQL product, inventory, order, customer, and sync tables.
- WooCommerce REST connector.
- Webhook listener for online orders.
- Background queue for retries.
- Device/location support for multiple counters and stores.
