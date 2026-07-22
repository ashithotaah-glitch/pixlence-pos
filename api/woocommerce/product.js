const env = process.env;

function getConfig() {
  const storeUrl = env.LPS_WC_URL || env.WC_STORE_URL || env.WOOCOMMERCE_STORE_URL;
  const consumerKey = env.LPS_WC_CONSUMER_KEY || env.WC_CONSUMER_KEY || env.WOOCOMMERCE_CONSUMER_KEY;
  const consumerSecret = env.LPS_WC_CONSUMER_SECRET || env.WC_CONSUMER_SECRET || env.WOOCOMMERCE_CONSUMER_SECRET;

  if (!storeUrl || !consumerKey || !consumerSecret) {
    return {
      error: "WooCommerce connector is not configured. Add LPS_WC_URL, LPS_WC_CONSUMER_KEY, and LPS_WC_CONSUMER_SECRET in Vercel."
    };
  }

  return {
    baseUrl: storeUrl.replace(/\/$/, ""),
    auth: `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64")}`
  };
}

async function wcRequest(config, path, options = {}) {
  const response = await fetch(`${config.baseUrl}/wp-json/wc/v3${path}`, {
    ...options,
    headers: {
      Authorization: config.auth,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.message || `WooCommerce HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

async function resolveCategory(config, name) {
  const cleanName = String(name || "").trim();
  if (!cleanName || cleanName.toLowerCase() === "uncategorized") return [];

  const found = await wcRequest(config, `/products/categories?search=${encodeURIComponent(cleanName)}&per_page=10`);
  const exact = found.find((category) => category.name.toLowerCase() === cleanName.toLowerCase());
  if (exact) return [{ id: exact.id }];

  const created = await wcRequest(config, "/products/categories", {
    method: "POST",
    body: JSON.stringify({ name: cleanName })
  });
  return [{ id: created.id }];
}

function productPayload(product, categories) {
  const price = Number(product.price || 0);
  const mrp = Number(product.mrp || price || 0);
  const salePrice = price && mrp && price < mrp ? String(price) : "";
  const regularPrice = String(mrp || price || 0);
  const payload = {
    name: String(product.name || "").trim(),
    type: "simple",
    status: "publish",
    catalog_visibility: "visible",
    sku: String(product.sku || product.barcode || "").trim(),
    regular_price: regularPrice,
    sale_price: salePrice,
    manage_stock: true,
    stock_quantity: Math.max(0, Number(product.stock || 0)),
    description: String(product.description || ""),
    short_description: product.brand ? `Brand: ${product.brand}` : "",
    categories,
    meta_data: [
      { key: "_pos_barcode", value: String(product.barcode || "") },
      { key: "_pos_source", value: "OmniPOS" }
    ]
  };

  if (product.image && /^https?:\/\//i.test(product.image)) {
    payload.images = [{ src: product.image }];
  }

  return payload;
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ ok: false, message: "Method not allowed" });
  }

  const config = getConfig();
  if (config.error) {
    return response.status(503).json({ ok: false, message: config.error });
  }

  try {
    const { product } = request.body || {};
    if (!product?.name || !product?.sku) {
      return response.status(400).json({ ok: false, message: "Product name and SKU are required" });
    }

    const categories = await resolveCategory(config, product.category);
    const payload = productPayload(product, categories);
    const existing = await wcRequest(config, `/products?sku=${encodeURIComponent(payload.sku)}&per_page=1`);

    const saved = existing.length
      ? await wcRequest(config, `/products/${existing[0].id}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        })
      : await wcRequest(config, "/products", {
          method: "POST",
          body: JSON.stringify(payload)
        });

    return response.status(200).json({
      ok: true,
      action: existing.length ? "updated" : "created",
      product: {
        id: saved.id,
        name: saved.name,
        sku: saved.sku,
        permalink: saved.permalink,
        stock_quantity: saved.stock_quantity
      }
    });
  } catch (error) {
    return response.status(error.status || 500).json({
      ok: false,
      message: error.message || "WooCommerce publish failed",
      details: error.payload || null
    });
  }
}
