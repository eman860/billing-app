/**
 * products.js – Product / Service catalog management page.
 */

let _products = [];

async function renderProducts() {
    const main = document.getElementById("main-content");
    main.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Products & Services</div>
        <div class="page-subtitle">Manage your item catalog with HSN/SAC codes and tax rates</div>
      </div>
      <div class="page-actions">
        <div class="search-bar">
          <input type="text" id="prod-search" placeholder="Search products…" oninput="filterProducts(this.value)" />
        </div>
        <button class="btn btn-primary" onclick="openProductModal()">+ Add Item</button>
      </div>
    </div>
    <div class="card">
      <div class="card-body" style="padding:0">
        <div class="table-wrap" id="products-table-wrap">
          <div class="page-loading"><div class="spinner"></div></div>
        </div>
      </div>
    </div>`;
    await loadProducts();
}

async function loadProducts(search) {
    try {
        _products = await api.getProducts(search);
        renderProductTable(_products);
    } catch (err) {
        document.getElementById("products-table-wrap").innerHTML =
            emptyState("⚠️", "Failed to load", err.message);
    }
}

function filterProducts(val) {
    clearTimeout(window._prodTimer);
    window._prodTimer = setTimeout(() => loadProducts(val), 300);
}

function renderProductTable(products) {
    const wrap = document.getElementById("products-table-wrap");
    if (!products.length) {
        wrap.innerHTML = emptyState("📦", "No products yet", "Add products or services to use in invoices.",
            `<button class="btn btn-primary" onclick="openProductModal()">+ Add Item</button>`);
        return;
    }
    wrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Name</th><th>HSN/SAC</th><th>Unit</th><th>Price</th><th>Tax Rate</th><th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${products.map(p => `
        <tr>
          <td>
            <strong>${esc(p.name)}</strong>
            ${p.description ? `<div class="text-muted" style="font-size:0.78rem">${esc(p.description)}</div>` : ""}
          </td>
          <td><code style="font-size:0.78rem;color:var(--accent-blue)">${esc(p.hsn_sac || "—")}</code></td>
          <td class="text-secondary">${esc(p.unit)}</td>
          <td><strong>${fmt(p.price)}</strong></td>
          <td>
            <span class="badge ${p.tax_rate === 0 ? "badge-draft" : "badge-blue"}">${p.tax_rate}%</span>
          </td>
          <td>
            <div class="table-actions">
              <button class="btn btn-secondary btn-sm" onclick="openProductModal(${p.id})">Edit</button>
              <button class="btn btn-danger btn-sm" onclick="deleteProduct(${p.id}, '${esc(p.name)}')">Delete</button>
            </div>
          </td>
        </tr>`).join("")}
      </tbody>
    </table>`;
}

const TAX_RATES = [0, 0.25, 3, 5, 12, 18, 28];

function openProductModal(id) {
    const p = id ? _products.find(x => x.id === id) : null;
    const title = p ? "Edit Item" : "Add Product / Service";
    openModal(title, `
    <form id="product-form" onsubmit="saveProduct(event, ${id || "null"})">
      <div class="form-group">
        <label>Name *</label>
        <input type="text" id="pf-name" value="${esc(p?.name || "")}" required />
      </div>
      <div class="form-group">
        <label>Description</label>
        <textarea id="pf-desc" rows="2">${esc(p?.description || "")}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>HSN / SAC Code</label>
          <input type="text" id="pf-hsn" value="${esc(p?.hsn_sac || "")}" placeholder="e.g. 998314" />
        </div>
        <div class="form-group">
          <label>Unit</label>
          <select id="pf-unit">
            ${["pcs", "hrs", "days", "kg", "ltr", "mtr", "nos", "set"].map(u =>
        `<option value="${u}" ${p?.unit === u ? "selected" : ""}>${u}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Price (₹) *</label>
          <input type="number" id="pf-price" value="${p?.price ?? ""}" min="0" step="0.01" required />
        </div>
        <div class="form-group">
          <label>GST Tax Rate</label>
          <select id="pf-tax">
            ${TAX_RATES.map(r =>
            `<option value="${r}" ${p?.tax_rate === r ? "selected" : ""}>${r}%</option>`).join("")}
          </select>
        </div>
      </div>
      <div id="product-form-error" class="form-error hidden"></div>
      <div class="modal-footer" style="padding:1rem 0 0">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">${p ? "Save Changes" : "Add Item"}</button>
      </div>
    </form>`);
}

async function saveProduct(e, id) {
    e.preventDefault();
    const errEl = document.getElementById("product-form-error");
    errEl.classList.add("hidden");
    const payload = {
        name: document.getElementById("pf-name").value.trim(),
        description: document.getElementById("pf-desc").value.trim() || null,
        hsn_sac: document.getElementById("pf-hsn").value.trim() || null,
        unit: document.getElementById("pf-unit").value,
        price: parseFloat(document.getElementById("pf-price").value),
        tax_rate: parseFloat(document.getElementById("pf-tax").value),
    };
    try {
        if (id) {
            await api.updateProduct(id, payload);
            toast("Product updated", "success");
        } else {
            await api.createProduct(payload);
            toast("Product added", "success");
        }
        closeModal();
        await loadProducts();
    } catch (err) {
        errEl.textContent = err.message;
        errEl.classList.remove("hidden");
    }
}

async function deleteProduct(id, name) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
        await api.deleteProduct(id);
        toast("Product deleted", "success");
        await loadProducts();
    } catch (err) {
        toast(err.message, "error");
    }
}
