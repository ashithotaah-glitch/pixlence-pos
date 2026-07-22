# OmniPOS Architecture

## Product direction

OmniPOS is a general POS and inventory platform hosted under Pixlence Labs, intended for many retail/ecommerce stores. Lucky Pet Shop can be the first connected store, but ecommerce connectors are channel plugins rather than hardcoded website logic.

Production host target: `https://pos.pixlencelabs.com`

## Source of truth

The POS should become the inventory source of truth.

- POS creates/updates products, SKUs, barcodes, prices, and stock.
- Ecommerce channels receive product and stock updates.
- Online orders flow back into POS and reduce stock centrally.
- Sync jobs are queued and retry-safe.

## Frontend modules

- Billing: barcode scan, cart, discounts, payment modes, invoice-ready order creation.
- Products: product master, SKU, barcode, brand, category, tax, image, price.
- Inventory: stock movements, receiving, manual adjustment, damage/write-off, sales ledger.
- Orders: POS and imported ecommerce orders.
- Channels: WooCommerce, Shopify, Custom API, SyncBot connector settings.
- Reports: sales, AOV, orders, queued sync, low-stock alerts.

## Backend modules for phase two

- Auth and roles: owner, manager, cashier, inventory user.
- Store/location management: support multiple branches and counters.
- Catalog API: products, variants, categories, brands, images, barcode uniqueness.
- Inventory API: stock by location, movements, audit log, purchase receiving.
- Orders API: POS orders, online orders, returns, exchanges, refunds.
- Customer API: phone-first customer profile and purchase history.
- Sync engine: connector registry, sync jobs, retries, webhook logs.
- Reports API: day close, tax summary, stock valuation, low stock, fast movers.

## Suggested database tables

- `users`
- `stores`
- `locations`
- `products`
- `product_variants`
- `categories`
- `brands`
- `inventory_balances`
- `inventory_movements`
- `customers`
- `orders`
- `order_items`
- `payments`
- `connectors`
- `sync_jobs`
- `webhook_events`
- `audit_logs`

## Connector contract

Each ecommerce connector should implement:

- `pushProduct(product)`
- `pushStock(variantOrSku, quantity)`
- `pushPrice(variantOrSku, price)`
- `pullOrders(since)`
- `handleWebhook(event)`
- `testConnection()`

## WooCommerce connector

Use the WooCommerce REST API:

- Match products by SKU/barcode.
- Create/update simple and variable products.
- Push stock quantity and stock status.
- Pull processing/completed orders.
- Register WooCommerce webhooks for order created and order updated.

## SyncBot connector

Use SyncBot for WhatsApp workflows:

- POS sale completed
- Online order imported
- Service booking captured
- Low-stock alert to admin
- Customer support or product enquiry event

## Offline model

The PWA should keep counter operations available during internet loss:

- Save sales locally.
- Deduct local stock immediately.
- Queue sync jobs.
- Reconcile with backend when online.
- Keep conflict logs for stock mismatches.

## Production security model

The browser app must not store ecommerce API secrets. Production should use:

- Staff login on `pos.pixlencelabs.com`.
- Server-side encrypted connector credentials.
- Per-store connector records.
- Backend API routes such as `/api/connectors/:id/products`.
- Optional WordPress bridge plugin on WooCommerce sites for stores that do not want to expose full WooCommerce REST credentials.
