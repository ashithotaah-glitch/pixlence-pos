# Deployment Plan

## Target

Host the app at:

`https://pos.pixlencelabs.com`

## Recommended production architecture

`pos.pixlencelabs.com`

- POS frontend
- POS backend API
- Staff authentication
- Store/tenant settings
- Connector credentials stored server-side
- Offline-capable browser cache and local sale queue

Connected ecommerce websites:

- WooCommerce stores
- Shopify stores
- Custom ecommerce APIs
- SyncBot for WhatsApp automations

## Why backend is required

The current PWA can run locally and queue sync actions, but a generic hosted POS cannot safely keep WooCommerce/Shopify API keys in browser storage.

Production must store keys in a backend database and expose controlled connector endpoints to the logged-in POS user.

## DNS

Create a DNS record for:

`pos.pixlencelabs.com`

The exact CNAME/A record depends on the hosting provider returned after deployment.

## First store connection

Lucky Pet Shop already has a protected WordPress bridge:

- `GET https://luckypetshop.in/wp-json/lps-pos/v1/products`
- `POST https://luckypetshop.in/wp-json/lps-pos/v1/stock`
- `POST https://luckypetshop.in/wp-json/lps-pos/v1/orders`

For a cross-domain POS backend, use a server-side token/credential flow rather than browser cookies.
