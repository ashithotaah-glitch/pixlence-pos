# Store Connections

OmniPOS is intended to run at `https://pos.pixlencelabs.com` and connect to many ecommerce stores through channel connectors.

## Connector types

- WooCommerce
- Shopify
- Custom API
- SyncBot

## Production connection model

The browser app should call the POS backend, not ecommerce websites directly.

Example:

`POS browser -> pos.pixlencelabs.com backend -> ecommerce connector -> store website`

This keeps API keys and webhook secrets server-side.

## WooCommerce connection options

Option A: WooCommerce REST API

- Store URL
- Consumer key
- Consumer secret
- Product/order/stock permissions

Option B: WordPress bridge plugin/snippet

- Store installs a protected bridge endpoint.
- POS backend authenticates server-to-server.
- Useful when the store owner does not want to share full WooCommerce REST keys.

## First example store

Lucky Pet Shop can be connected as the first WooCommerce store. A protected WordPress bridge already exists there:

- `GET https://luckypetshop.in/wp-json/lps-pos/v1/products`
- `POST https://luckypetshop.in/wp-json/lps-pos/v1/stock`
- `POST https://luckypetshop.in/wp-json/lps-pos/v1/orders`

For cross-domain production use, the POS backend should authenticate to that bridge with a server-side token flow rather than browser cookies.

## Live product publishing

The POS includes a Vercel serverless endpoint:

`POST /api/woocommerce/product`

This endpoint creates or updates a WooCommerce product by SKU, publishes it, creates the product category if needed, and syncs stock quantity.

Set these Vercel production environment variables for Lucky Pet Shop:

- `LPS_WC_URL` = `https://luckypetshop.in`
- `LPS_WC_CONSUMER_KEY` = WooCommerce REST API consumer key
- `LPS_WC_CONSUMER_SECRET` = WooCommerce REST API consumer secret

The browser never receives these credentials. Product publishing will show as failed in the POS until the variables are configured and the project is redeployed.
