const STORAGE_KEY = "omni-pos-state-v1";

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

const demoProducts = [
  {
    id: crypto.randomUUID(),
    name: "Premium Adult Dog Food 3kg",
    sku: "DOG-FOOD-3KG",
    barcode: "8901001003011",
    category: "Dog Food",
    brand: "Demo Pet Co",
    mrp: 1799,
    price: 1599,
    stock: 24,
    tax: 18,
    image: "",
    lowStock: 5
  },
  {
    id: crypto.randomUUID(),
    name: "Cat Salmon Wet Food 12 Pack",
    sku: "CAT-WET-12",
    barcode: "8901001003028",
    category: "Cat Food",
    brand: "Demo Pet Co",
    mrp: 1199,
    price: 1049,
    stock: 18,
    tax: 18,
    image: "",
    lowStock: 5
  },
  {
    id: crypto.randomUUID(),
    name: "Chicken Jerky Treats 200g",
    sku: "TRT-JERKY-200",
    barcode: "8901001003035",
    category: "Treats",
    brand: "Happy Paws",
    mrp: 399,
    price: 349,
    stock: 42,
    tax: 18,
    image: "",
    lowStock: 8
  },
  {
    id: crypto.randomUUID(),
    name: "Rope Leash - Medium",
    sku: "WALK-LEASH-M",
    barcode: "8901001003042",
    category: "Walk Essentials",
    brand: "Trail Mate",
    mrp: 699,
    price: 499,
    stock: 12,
    tax: 18,
    image: "",
    lowStock: 4
  },
  {
    id: crypto.randomUUID(),
    name: "Grooming Brush Soft Pin",
    sku: "GRM-BRUSH-SP",
    barcode: "8901001003059",
    category: "Grooming",
    brand: "Coat Care",
    mrp: 599,
    price: 449,
    stock: 9,
    tax: 18,
    image: "",
    lowStock: 4
  },
  {
    id: crypto.randomUUID(),
    name: "Pet Dental Care Gel",
    sku: "CARE-DENTAL-GEL",
    barcode: "8901001003066",
    category: "Pharmacy",
    brand: "Vet Daily",
    mrp: 299,
    price: 249,
    stock: 16,
    tax: 12,
    image: "",
    lowStock: 5
  }
];

let state = loadState();
let activeCategory = "All";
let activePayment = "Cash";
let activeSearch = "";
let cart = [];
let scannerStream = null;
let scannerTimer = null;
let zxingReader = null;
let zxingControls = null;
let lastScannedCode = "";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function defaultState() {
  return {
    products: [],
    orders: [],
    movements: [],
    connectors: [
      {
        id: crypto.randomUUID(),
        type: "WooCommerce",
        name: "Demo WooCommerce Store",
        url: "https://example-store.com",
        status: "Draft"
      }
    ],
    syncQueue: []
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved || defaultState();
  } catch {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  updateConnection();
}

function toast(message) {
  const node = $("#toast");
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove("show"), 2600);
}

function updateConnection() {
  $("#connectionLabel").textContent = navigator.onLine ? "Online" : "Offline ready";
  $("#syncLabel").textContent = `${state.syncQueue.filter((job) => job.status === "Queued").length} sync jobs queued`;
}

function setView(view) {
  $$(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  $$(".view").forEach((section) => section.classList.remove("active"));
  $(`#${view}View`).classList.add("active");
  const titles = {
    billing: "Billing counter",
    products: "Product catalog",
    inventory: "Inventory management",
    orders: "Order history",
    sync: "Sales channels",
    reports: "Reports"
  };
  $("#viewTitle").textContent = titles[view];
  renderAll();
}

function productInitials(product) {
  return product.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function filteredProducts() {
  return state.products.filter((product) => {
    const categoryMatch = activeCategory === "All" || product.category === activeCategory;
    const haystack = `${product.name} ${product.sku} ${product.barcode} ${product.brand} ${product.category}`.toLowerCase();
    return categoryMatch && haystack.includes(activeSearch.toLowerCase());
  });
}

function addToCart(productId) {
  const product = state.products.find((item) => item.id === productId);
  if (!product) return;
  if (product.stock <= 0) {
    toast(`${product.name} is out of stock`);
    return;
  }
  const line = cart.find((item) => item.productId === productId);
  if (line) {
    if (line.qty >= product.stock) {
      toast(`Only ${product.stock} units available`);
      return;
    }
    line.qty += 1;
  } else {
    cart.push({ productId, qty: 1 });
  }
  renderCart();
}

function findProductByCode(code) {
  const normalized = String(code || "").trim().toLowerCase();
  if (!normalized) return null;
  return state.products.find((item) =>
    item.barcode.toLowerCase() === normalized || item.sku.toLowerCase() === normalized
  );
}

function addScannedCode(code) {
  const product = findProductByCode(code);
  if (product) {
    addToCart(product.id);
    toast(`Added ${product.name}`);
    return true;
  }
  prepareUnknownBarcode(code);
  return false;
}

function prepareUnknownBarcode(code) {
  const normalized = String(code || "").trim();
  if (!normalized) {
    toast("No barcode detected");
    return;
  }
  toast(`Barcode ${normalized} is not in catalog. Add product details.`);
  closeCameraScanner();
  setView("products");
  $("#productForm").reset();
  $("#productId").value = "";
  $("#productSku").value = normalized;
  $("#productBarcode").value = normalized;
  $("#productCategory").value = "Uncategorized";
  $("#productTax").value = "18";
  $("#productFormTitle").textContent = "Add scanned product";
  $("#productName").focus();
}

async function openCameraScanner() {
  const modal = $("#scannerModal");
  const help = $("#scannerHelp");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  help.textContent = "Requesting camera access...";

  if (!("mediaDevices" in navigator) || !navigator.mediaDevices.getUserMedia) {
    help.textContent = "Camera access is not available in this browser. Use manual barcode/SKU entry.";
    $("#manualScannerInput").focus();
    return;
  }

  try {
    scannerStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false
    });
    const video = $("#scannerVideo");
    video.srcObject = scannerStream;
    await video.play();
    help.textContent = "Camera is open. Hold the barcode steady inside the frame.";

    if ("BarcodeDetector" in window) {
      const detector = new BarcodeDetector({
        formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "qr_code"]
      });
      scannerTimer = window.setInterval(async () => {
        if (!video.videoWidth) return;
        try {
          const codes = await detector.detect(video);
          if (!codes.length) return;
          handleDetectedCode(codes[0].rawValue);
        } catch (error) {
          help.textContent = "Camera is open. Try holding the barcode closer or use manual entry.";
        }
      }, 450);
      return;
    }

    if (window.ZXing && window.ZXing.BrowserMultiFormatReader) {
      help.textContent = "Camera is open. Using compatibility scanner for this browser.";
      if (scannerStream) {
        scannerStream.getTracks().forEach((track) => track.stop());
        scannerStream = null;
        video.srcObject = null;
      }
      zxingReader = new window.ZXing.BrowserMultiFormatReader();
      const result = zxingReader.decodeFromVideoDevice(null, video, (scanResult) => {
        if (scanResult && scanResult.text) {
          handleDetectedCode(scanResult.text);
        }
      });
      if (result && typeof result.then === "function") {
        result.catch(() => {
          help.textContent = "Camera is open, but barcode scanning could not start. Use manual entry.";
        });
      }
      return;
    }

    help.textContent = "Camera is open, but this browser needs manual barcode/SKU entry.";
  } catch (error) {
    help.textContent = "Camera permission was blocked or unavailable. Use manual barcode/SKU entry.";
    $("#manualScannerInput").focus();
  }
}

function handleDetectedCode(value) {
  const code = String(value || "").trim();
  if (!code || code === lastScannedCode) return;
  lastScannedCode = code;
  $("#scannerHelp").textContent = `Detected ${code}`;
  if (addScannedCode(code)) {
    closeCameraScanner();
  }
}

function closeCameraScanner() {
  if (scannerTimer) {
    window.clearInterval(scannerTimer);
    scannerTimer = null;
  }
  if (zxingControls && typeof zxingControls.stop === "function") {
    zxingControls.stop();
    zxingControls = null;
  }
  if (zxingReader && typeof zxingReader.reset === "function") {
    zxingReader.reset();
    zxingReader = null;
  }
  if (scannerStream) {
    scannerStream.getTracks().forEach((track) => track.stop());
    scannerStream = null;
  }
  const video = $("#scannerVideo");
  video.pause();
  video.srcObject = null;
  lastScannedCode = "";
  $("#scannerModal").classList.remove("open");
  $("#scannerModal").setAttribute("aria-hidden", "true");
  $("#barcodeInput").focus();
}

function updateCartQty(productId, delta) {
  const product = state.products.find((item) => item.id === productId);
  const line = cart.find((item) => item.productId === productId);
  if (!line || !product) return;
  const nextQty = line.qty + delta;
  if (nextQty <= 0) {
    cart = cart.filter((item) => item.productId !== productId);
  } else if (nextQty <= product.stock) {
    line.qty = nextQty;
  } else {
    toast(`Only ${product.stock} units available`);
  }
  renderCart();
}

function cartTotals() {
  const subtotal = cart.reduce((sum, line) => {
    const product = state.products.find((item) => item.id === line.productId);
    return sum + (product ? product.price * line.qty : 0);
  }, 0);
  const discount = Number($("#discountInput")?.value || 0);
  const taxable = Math.max(0, subtotal - discount);
  const tax = Math.round(taxable * 0.03);
  return { subtotal, discount, tax, total: taxable + tax };
}

function completeSale() {
  if (!cart.length) {
    toast("Cart is empty");
    return;
  }
  const totals = cartTotals();
  const order = {
    id: `POS-${Date.now().toString().slice(-8)}`,
    channel: "POS",
    customer: {
      name: $("#customerName").value.trim() || "Walk-in customer",
      phone: $("#customerPhone").value.trim()
    },
    payment: activePayment,
    status: navigator.onLine ? "Completed" : "Offline completed",
    items: cart.map((line) => {
      const product = state.products.find((item) => item.id === line.productId);
      return {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        qty: line.qty,
        price: product.price
      };
    }),
    totals,
    createdAt: new Date().toISOString()
  };

  order.items.forEach((item) => {
    const product = state.products.find((entry) => entry.id === item.productId);
    product.stock -= item.qty;
    state.movements.unshift({
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      sku: product.sku,
      type: "sale",
      qty: -item.qty,
      note: order.id
    });
  });

  state.orders.unshift(order);
  enqueueSync("WooCommerce", "order.created", order);
  enqueueSync("SyncBot", "pos.sale.completed", {
    order_id: order.id,
    contact: order.customer,
    total: order.totals.total
  });
  cart = [];
  $("#customerPhone").value = "";
  $("#customerName").value = "";
  $("#discountInput").value = "0";
  saveState();
  renderAll();
  toast(`Sale ${order.id} completed`);
}

function enqueueSync(channel, event, payload) {
  state.syncQueue.unshift({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    channel,
    event,
    status: navigator.onLine ? "Queued" : "Offline queued",
    payload
  });
}

function upsertProduct(event) {
  event.preventDefault();
  const id = $("#productId").value || crypto.randomUUID();
  const existing = state.products.find((product) => product.id === id);
  const product = {
    id,
    name: $("#productName").value.trim(),
    sku: $("#productSku").value.trim(),
    barcode: $("#productBarcode").value.trim(),
    category: $("#productCategory").value.trim(),
    brand: $("#productBrand").value.trim(),
    mrp: Number($("#productMrp").value || 0),
    price: Number($("#productPrice").value || 0),
    stock: Number($("#productStock").value || 0),
    tax: Number($("#productTax").value || 0),
    image: $("#productImage").value.trim(),
    lowStock: existing?.lowStock || 5
  };
  if (!product.name || !product.sku || !product.barcode) {
    toast("Name, SKU, and barcode are required");
    return;
  }
  const duplicate = state.products.find((item) => item.id !== id && (item.sku === product.sku || item.barcode === product.barcode));
  if (duplicate) {
    toast("SKU or barcode already exists");
    return;
  }
  if (existing) {
    Object.assign(existing, product);
  } else {
    state.products.unshift(product);
    state.movements.unshift({
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      sku: product.sku,
      type: "opening",
      qty: product.stock,
      note: "Opening stock"
    });
  }
  enqueueSync("WooCommerce", existing ? "product.updated" : "product.created", product);
  event.target.reset();
  $("#productId").value = "";
  $("#productTax").value = "18";
  $("#productFormTitle").textContent = "Add product";
  saveState();
  renderAll();
  toast("Product saved");
}

function editProduct(id) {
  const product = state.products.find((item) => item.id === id);
  if (!product) return;
  setView("products");
  $("#productId").value = product.id;
  $("#productName").value = product.name;
  $("#productSku").value = product.sku;
  $("#productBarcode").value = product.barcode;
  $("#productCategory").value = product.category;
  $("#productBrand").value = product.brand;
  $("#productMrp").value = product.mrp;
  $("#productPrice").value = product.price;
  $("#productStock").value = product.stock;
  $("#productTax").value = product.tax;
  $("#productImage").value = product.image || "";
  $("#productFormTitle").textContent = "Edit product";
}

function postStock(event) {
  event.preventDefault();
  const product = state.products.find((item) => item.id === $("#stockProduct").value);
  if (!product) return;
  const type = $("#stockType").value;
  const enteredQty = Number($("#stockQty").value || 0);
  if (!enteredQty) {
    toast("Enter quantity");
    return;
  }
  const qty = type === "damage" ? -Math.abs(enteredQty) : enteredQty;
  product.stock = Math.max(0, product.stock + qty);
  const movement = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    sku: product.sku,
    type,
    qty,
    note: $("#stockNote").value.trim()
  };
  state.movements.unshift(movement);
  enqueueSync("WooCommerce", "stock.updated", {
    sku: product.sku,
    barcode: product.barcode,
    stock: product.stock,
    movement
  });
  event.target.reset();
  saveState();
  renderAll();
  toast("Stock movement posted");
}

function saveConnector(event) {
  event.preventDefault();
  const connector = {
    id: crypto.randomUUID(),
    type: $("#connectorType").value,
    name: $("#connectorName").value.trim() || $("#connectorType").value,
    url: $("#connectorUrl").value.trim(),
    key: $("#connectorKey").value.trim(),
    status: "Draft"
  };
  state.connectors.unshift(connector);
  event.target.reset();
  saveState();
  renderAll();
  toast("Connector saved");
}

async function importChannelProducts() {
  const connector = state.connectors.find((item) => item.type === "WooCommerce") || state.connectors[0];
  if (!connector) {
    toast("Add a connector before importing products");
    return;
  }
  const endpoint = `/api/connectors/${connector.id}/products`;
  if (!location.hostname.includes("pos.pixlencelabs.com")) {
    toast("Product import is queued. Backend connector will run after hosted setup.");
    enqueueSync(connector.type, "products.import.requested", {
      status: "waiting_for_backend_connector",
      connector_id: connector.id,
      endpoint
    });
    saveState();
    renderAll();
    return;
  }
  try {
    const response = await fetch(endpoint, { credentials: "same-origin" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const imported = payload.products || [];
    imported.forEach((product) => {
      const existing = state.products.find((item) => item.sku && product.sku && item.sku === product.sku);
      const mapped = {
        id: existing?.id || crypto.randomUUID(),
        name: product.name,
        sku: product.sku || `LPS-${product.id}`,
        barcode: product.barcode || product.sku || `LPS-${product.id}`,
        category: product.category || "Website",
        brand: product.brand || "",
        mrp: Number(product.regular_price || product.price || 0),
        price: Number(product.sale_price || product.price || product.regular_price || 0),
        stock: Number(product.stock_quantity || 0),
        tax: 18,
        image: product.image || "",
        lowStock: 5
      };
      if (existing) Object.assign(existing, mapped);
      else state.products.push(mapped);
    });
    enqueueSync(connector.type, "products.imported", { count: imported.length, connector_id: connector.id });
    saveState();
    renderAll();
    toast(`Imported ${imported.length} products from ${connector.name}`);
  } catch (error) {
    enqueueSync(connector.type, "products.import.failed", { message: error.message, connector_id: connector.id });
    saveState();
    renderAll();
    toast("Could not import products. Check connector/backend.");
  }
}

function seedData() {
  if (state.products.length && !confirm("Demo data will add products to the current catalog. Continue?")) return;
  state.products = [...demoProducts, ...state.products];
  demoProducts.forEach((product) => {
    state.movements.unshift({
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      sku: product.sku,
      type: "opening",
      qty: product.stock,
      note: "Demo opening stock"
    });
  });
  saveState();
  renderAll();
  toast("Demo products loaded");
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `omni-pos-export-${new Date().toISOString().slice(0,10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function renderCategories() {
  const categories = ["All", ...new Set(state.products.map((product) => product.category).filter(Boolean))];
  $("#categoryChips").innerHTML = categories.map((category) => (
    `<button class="chip ${category === activeCategory ? "active" : ""}" data-category="${escapeHtml(category)}" type="button">${escapeHtml(category)}</button>`
  )).join("");
}

function renderProducts() {
  const products = filteredProducts();
  $("#productGrid").innerHTML = products.length ? products.map((product) => `
    <article class="product-card">
      <div class="product-thumb">${product.image ? `<img src="${escapeAttr(product.image)}" alt="">` : productInitials(product)}</div>
      <div class="product-body">
        <span class="meta">${escapeHtml(product.brand || "Store brand")} · ${escapeHtml(product.category)}</span>
        <strong class="product-name">${escapeHtml(product.name)}</strong>
        <div class="product-foot">
          <div><span class="price">${money.format(product.price)}</span><br><span class="stock">${product.stock} in stock</span></div>
          <button class="mini-add" data-add="${product.id}" type="button" aria-label="Add ${escapeAttr(product.name)}">+</button>
        </div>
      </div>
    </article>
  `).join("") : `<div class="empty">No products found. Add products or load demo data.</div>`;
}

function renderCart() {
  $("#cartCount").textContent = `${cart.reduce((sum, item) => sum + item.qty, 0)} items`;
  $("#cartItems").innerHTML = cart.length ? cart.map((line) => {
    const product = state.products.find((item) => item.id === line.productId);
    if (!product) return "";
    return `
      <div class="cart-line">
        <div>
          <strong>${escapeHtml(product.name)}</strong>
          <span class="meta">${escapeHtml(product.sku)} · ${money.format(product.price)}</span>
          <div class="qty-row">
            <button data-qty="${product.id}" data-delta="-1" type="button">−</button>
            <span>${line.qty}</span>
            <button data-qty="${product.id}" data-delta="1" type="button">+</button>
          </div>
        </div>
        <strong>${money.format(product.price * line.qty)}</strong>
      </div>
    `;
  }).join("") : `<div class="empty">Scan a barcode or tap a product to start billing.</div>`;
  const totals = cartTotals();
  $("#subtotalValue").textContent = money.format(totals.subtotal);
  $("#taxValue").textContent = money.format(totals.tax);
  $("#totalValue").textContent = money.format(totals.total);
}

function renderProductTable() {
  $("#productTable").innerHTML = state.products.length ? state.products.map((product) => `
    <tr>
      <td>${escapeHtml(product.sku)}</td>
      <td>${escapeHtml(product.name)}<br><span class="meta">${escapeHtml(product.brand || "No brand")} · ${escapeHtml(product.category)}</span></td>
      <td>${escapeHtml(product.barcode)}</td>
      <td>${money.format(product.price)}</td>
      <td>${product.stock}</td>
      <td><button class="button subtle" data-edit="${product.id}" type="button">Edit</button></td>
    </tr>
  `).join("") : `<tr><td colspan="6">No products yet.</td></tr>`;
}

function renderInventory() {
  $("#skuKpi").textContent = state.products.length;
  $("#unitsKpi").textContent = state.products.reduce((sum, product) => sum + product.stock, 0);
  $("#lowKpi").textContent = state.products.filter((product) => product.stock <= (product.lowStock || 5)).length;
  $("#stockProduct").innerHTML = state.products.map((product) => `<option value="${product.id}">${escapeHtml(product.sku)} · ${escapeHtml(product.name)}</option>`).join("");
  $("#movementTable").innerHTML = state.movements.length ? state.movements.slice(0, 80).map((movement) => `
    <tr>
      <td>${formatDate(movement.at)}</td>
      <td>${escapeHtml(movement.sku)}</td>
      <td>${escapeHtml(movement.type)}</td>
      <td>${movement.qty}</td>
      <td>${escapeHtml(movement.note || "")}</td>
    </tr>
  `).join("") : `<tr><td colspan="5">No inventory movements yet.</td></tr>`;
}

function renderOrders() {
  $("#ordersTable").innerHTML = state.orders.length ? state.orders.map((order) => `
    <tr>
      <td>${escapeHtml(order.id)}<br><span class="meta">${formatDate(order.createdAt)}</span></td>
      <td>${escapeHtml(order.channel)}</td>
      <td>${escapeHtml(order.customer.name)}<br><span class="meta">${escapeHtml(order.customer.phone || "No phone")}</span></td>
      <td>${order.items.reduce((sum, item) => sum + item.qty, 0)}</td>
      <td>${money.format(order.totals.total)}</td>
      <td>${escapeHtml(order.payment)}</td>
      <td>${escapeHtml(order.status)}</td>
    </tr>
  `).join("") : `<tr><td colspan="7">No orders yet.</td></tr>`;
}

function renderConnectors() {
  $("#connectorList").innerHTML = state.connectors.map((connector) => `
    <article class="connector-card">
      <strong>${escapeHtml(connector.type)}</strong>
      <small>${escapeHtml(connector.name)} · ${escapeHtml(connector.status)}</small>
      <small>${escapeHtml(connector.url || "Endpoint not set")}</small>
    </article>
  `).join("");
  $("#syncTable").innerHTML = state.syncQueue.length ? state.syncQueue.slice(0, 80).map((job) => `
    <tr>
      <td>${formatDate(job.at)}</td>
      <td>${escapeHtml(job.channel)}</td>
      <td>${escapeHtml(job.event)}</td>
      <td>${escapeHtml(job.status)}</td>
      <td><code>${escapeHtml(JSON.stringify(job.payload).slice(0, 80))}</code></td>
    </tr>
  `).join("") : `<tr><td colspan="5">No sync jobs yet.</td></tr>`;
}

function renderReports() {
  const today = new Date().toISOString().slice(0, 10);
  const todayOrders = state.orders.filter((order) => order.createdAt.slice(0, 10) === today);
  const sales = todayOrders.reduce((sum, order) => sum + order.totals.total, 0);
  $("#salesKpi").textContent = money.format(sales);
  $("#ordersKpi").textContent = todayOrders.length;
  $("#aovKpi").textContent = money.format(todayOrders.length ? sales / todayOrders.length : 0);
  $("#queueKpi").textContent = state.syncQueue.filter((job) => job.status.includes("Queued")).length;
  const low = state.products.filter((product) => product.stock <= (product.lowStock || 5));
  $("#insightCard").innerHTML = low.length
    ? `<strong>${low.length} products need attention.</strong><p>${escapeHtml(low.slice(0, 4).map((product) => product.name).join(", "))}</p>`
    : `<strong>Inventory looks healthy.</strong><p>No low-stock products in the current catalog.</p>`;
}

function renderAll() {
  renderCategories();
  renderProducts();
  renderCart();
  renderProductTable();
  renderInventory();
  renderOrders();
  renderConnectors();
  renderReports();
  updateConnection();
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function bindEvents() {
  const on = (selector, eventName, handler) => {
    const node = $(selector);
    if (node) node.addEventListener(eventName, handler);
  };
  $$(".nav-item").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
  on("#seedDataBtn", "click", seedData);
  on("#exportBtn", "click", exportData);
  on("#clearCartBtn", "click", () => {
    cart = [];
    renderCart();
  });
  on("#globalSearch", "input", (event) => {
    activeSearch = event.target.value;
    renderProducts();
  });
  on("#barcodeInput", "keydown", (event) => {
    if (event.key !== "Enter") return;
    const code = event.target.value.trim();
    if (addScannedCode(code)) {
      event.target.value = "";
    }
  });
  on("#cameraScanBtn", "click", openCameraScanner);
  on("#closeScannerBtn", "click", closeCameraScanner);
  on("#manualScannerBtn", "click", () => {
    const input = $("#manualScannerInput");
    if (addScannedCode(input.value)) {
      input.value = "";
      closeCameraScanner();
    }
  });
  on("#manualScannerInput", "keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    $("#manualScannerBtn").click();
  });
  on("#discountInput", "input", renderCart);
  on("#checkoutBtn", "click", completeSale);
  on("#productForm", "submit", upsertProduct);
  on("#stockForm", "submit", postStock);
  on("#connectorForm", "submit", saveConnector);
  on("#importChannelBtn", "click", importChannelProducts);
  on("#newProductBtn", "click", () => {
    $("#productForm").reset();
    $("#productId").value = "";
    $("#productTax").value = "18";
    $("#productFormTitle").textContent = "Add product";
  });
  document.addEventListener("click", (event) => {
    const add = event.target.closest("[data-add]");
    if (add) addToCart(add.dataset.add);
    const edit = event.target.closest("[data-edit]");
    if (edit) editProduct(edit.dataset.edit);
    const chip = event.target.closest("[data-category]");
    if (chip) {
      activeCategory = chip.dataset.category;
      renderCategories();
      renderProducts();
    }
    const qty = event.target.closest("[data-qty]");
    if (qty) updateCartQty(qty.dataset.qty, Number(qty.dataset.delta));
    const pay = event.target.closest("[data-payment]");
    if (pay) {
      activePayment = pay.dataset.payment;
      $$(".pay-mode").forEach((button) => button.classList.toggle("active", button === pay));
    }
  });
  window.addEventListener("online", updateConnection);
  window.addEventListener("offline", updateConnection);
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("./sw.js");
  } catch (error) {
    console.warn("Service worker registration failed", error);
  }
}

bindEvents();
renderAll();
registerServiceWorker();
