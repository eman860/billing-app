/**
 * invoices.js – Invoice list, creation, and PDF-ready view.
 */

let _invoices = [];
let _invoiceCustomers = [];
let _invoiceProducts = [];
let _invoiceLineItems = [];

// ── List Page ─────────────────────────────────────────────────────────────────

async function renderInvoices() {
    const main = document.getElementById("main-content");
    main.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Invoices</div>
        <div class="page-subtitle">Create and manage GST invoices</div>
      </div>
      <div class="page-actions">
        <select id="inv-filter-status" onchange="filterInvoices()" class="btn btn-secondary" style="padding:0.55rem 1rem">
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="paid">Paid</option>
        </select>
        <button class="btn btn-primary" onclick="openCreateInvoice()">+ New Invoice</button>
      </div>
    </div>
    <div class="card">
      <div class="card-body" style="padding:0">
        <div class="table-wrap" id="invoices-table-wrap">
          <div class="page-loading"><div class="spinner"></div></div>
        </div>
      </div>
    </div>`;
    await loadInvoices();
}

async function loadInvoices() {
    const status = document.getElementById("inv-filter-status")?.value;
    try {
        _invoices = await api.getInvoices(status ? { status } : null);
        renderInvoiceTable(_invoices);
    } catch (err) {
        document.getElementById("invoices-table-wrap").innerHTML =
            emptyState("⚠️", "Failed to load", err.message);
    }
}

function filterInvoices() { loadInvoices(); }

function renderInvoiceTable(invoices) {
    const wrap = document.getElementById("invoices-table-wrap");
    if (!invoices.length) {
        wrap.innerHTML = emptyState("🧾", "No invoices yet", "Create your first GST invoice.",
            `<button class="btn btn-primary" onclick="openCreateInvoice()">+ New Invoice</button>`);
        return;
    }
    wrap.innerHTML = `
    <table>
      <thead>
        <tr><th>#</th><th>Date</th><th>Customer</th><th>Supply</th><th>Grand Total</th><th>Paid</th><th>Outstanding</th><th>Status</th><th>Actions</th></tr>
      </thead>
      <tbody>
        ${invoices.map(inv => `
        <tr>
          <td><strong style="color:var(--brand-light)">${esc(inv.invoice_number)}</strong></td>
          <td class="text-secondary">${fmtDate(inv.invoice_date)}</td>
          <td>${esc(inv.customer_name || "—")}</td>
          <td><span class="badge ${inv.supply_type === "interstate" ? "badge-amber" : "badge-blue"}">${inv.supply_type}</span></td>
          <td><strong>${fmt(inv.grand_total)}</strong></td>
          <td class="text-green">${fmt(inv.amount_paid)}</td>
          <td class="${inv.outstanding > 0 ? "text-amber" : "text-green"}">${fmt(inv.outstanding)}</td>
          <td>${statusBadge(inv.status)}</td>
          <td>
            <div class="table-actions">
              <button class="btn btn-secondary btn-sm" onclick="viewInvoice(${inv.id})">View</button>
              ${inv.status !== "paid" ? `<button class="btn btn-ghost btn-sm" onclick="changeStatus(${inv.id}, '${inv.status}')">Status</button>` : ""}
            </div>
          </td>
        </tr>`).join("")}
      </tbody>
    </table>`;
}

// ── Status Update ─────────────────────────────────────────────────────────────

async function changeStatus(id, current) {
    const next = { draft: "sent", sent: "paid", paid: "draft" };
    const label = { draft: "Mark as Sent", sent: "Mark as Paid", paid: "Revert to Draft" };
    if (!confirm(`${label[current]}?`)) return;
    try {
        await api.updateStatus(id, next[current]);
        toast("Status updated", "success");
        await loadInvoices();
    } catch (err) {
        toast(err.message, "error");
    }
}

// ── Detail / Print View ───────────────────────────────────────────────────────

async function viewInvoice(id) {
    let inv;
    try { inv = await api.getInvoice(id); }
    catch (err) { toast(err.message, "error"); return; }

    const isIntrastate = inv.supply_type === "intrastate";
    openModal(`Invoice ${inv.invoice_number}`, `
    <div class="invoice-print" id="inv-print-area">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:1rem;margin-bottom:1.5rem">
        <div>
          <h2>TAX INVOICE</h2>
          <div style="font-size:0.85rem;color:#64748b;margin-top:0.25rem">NeuraBills – GST Compliant</div>
        </div>
        <div style="text-align:right;font-size:0.85rem">
          <div><strong>Invoice #:</strong> ${esc(inv.invoice_number)}</div>
          <div><strong>Date:</strong> ${fmtDate(inv.invoice_date)}</div>
          ${inv.due_date ? `<div><strong>Due:</strong> ${fmtDate(inv.due_date)}</div>` : ""}
          <div style="margin-top:0.25rem">
            <span style="padding:2px 8px;border-radius:20px;background:${inv.status === "paid" ? "#dcfce7" : "#fef9c3"};color:${inv.status === "paid" ? "#166534" : "#854d0e"};font-size:0.78rem;font-weight:600;text-transform:uppercase">${inv.status}</span>
          </div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-bottom:1.5rem;font-size:0.85rem">
        <div>
          <div style="font-weight:700;margin-bottom:0.25rem;color:#4f46e5">Bill To</div>
          <div style="font-weight:600">${esc(inv.customer_name || "Unknown")}</div>
        </div>
        <div>
          <div style="font-weight:700;margin-bottom:0.25rem;color:#4f46e5">Supply Type</div>
          <div style="text-transform:capitalize">${inv.supply_type}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>#</th><th>Description</th><th>HSN/SAC</th><th>Qty</th><th>Rate</th><th>Taxable</th>
            ${isIntrastate ? "<th>CGST</th><th>SGST</th>" : "<th>IGST</th>"}
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${inv.items.map((it, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${esc(it.description)}</td>
            <td>${esc(it.hsn_sac || "—")}</td>
            <td>${it.quantity}</td>
            <td>${fmt(it.unit_price)}</td>
            <td>${fmt(it.taxable_amount)}</td>
            ${isIntrastate
            ? `<td>${fmt(it.cgst_amount)}<br><small style="color:#64748b">${it.cgst_rate}%</small></td>
                 <td>${fmt(it.sgst_amount)}<br><small style="color:#64748b">${it.sgst_rate}%</small></td>`
            : `<td>${fmt(it.igst_amount)}<br><small style="color:#64748b">${it.igst_rate}%</small></td>`}
            <td><strong>${fmt(it.total_amount)}</strong></td>
          </tr>`).join("")}
        </tbody>
      </table>

      <div class="total-section" style="margin-top:1rem">
        <table style="width:auto;margin-left:auto;min-width:260px">
          <tr><td style="padding:0.3rem 0.5rem;color:#64748b">Subtotal</td><td style="padding:0.3rem 0.5rem;text-align:right">${fmt(inv.subtotal)}</td></tr>
          ${isIntrastate
            ? `<tr><td style="padding:0.3rem 0.5rem;color:#64748b">CGST</td><td style="padding:0.3rem 0.5rem;text-align:right">${fmt(inv.total_cgst)}</td></tr>
               <tr><td style="padding:0.3rem 0.5rem;color:#64748b">SGST</td><td style="padding:0.3rem 0.5rem;text-align:right">${fmt(inv.total_sgst)}</td></tr>`
            : `<tr><td style="padding:0.3rem 0.5rem;color:#64748b">IGST</td><td style="padding:0.3rem 0.5rem;text-align:right">${fmt(inv.total_igst)}</td></tr>`}
          <tr style="border-top:2px solid #e2e8f0">
            <td style="padding:0.5rem 0.5rem;font-weight:700">Grand Total</td>
            <td class="grand-total" style="padding:0.5rem 0.5rem;text-align:right">${fmt(inv.grand_total)}</td>
          </tr>
          <tr><td style="padding:0.3rem 0.5rem;color:#22c55e">Amount Paid</td><td style="padding:0.3rem 0.5rem;text-align:right;color:#22c55e">${fmt(inv.amount_paid)}</td></tr>
          <tr><td style="padding:0.3rem 0.5rem;color:#f59e0b;font-weight:600">Outstanding</td><td style="padding:0.3rem 0.5rem;text-align:right;color:#f59e0b;font-weight:600">${fmt(inv.outstanding)}</td></tr>
        </table>
      </div>
      ${inv.notes ? `<div style="margin-top:1.5rem;padding:0.75rem;background:#f8fafc;border-radius:6px;font-size:0.85rem"><strong>Notes:</strong> ${esc(inv.notes)}</div>` : ""}
    </div>
    <div style="display:flex;gap:0.75rem;justify-content:flex-end;margin-top:1rem">
      <button class="btn btn-secondary" onclick="printInvoice()">🖨 Print / PDF</button>
      <button class="btn btn-ghost" onclick="closeModal()">Close</button>
    </div>
  `, true);
}

function printInvoice() {
    const content = document.getElementById("inv-print-area").innerHTML;
    const win = window.open("", "_blank");
    win.document.write(`<!DOCTYPE html><html><head><title>Invoice</title>
    <style>body{font-family:Arial,sans-serif;padding:2rem;font-size:13px}
    table{width:100%;border-collapse:collapse}
    th{background:#f1f5f9;padding:6px 8px;text-align:left;font-size:11px;text-transform:uppercase}
    td{padding:6px 8px;border-bottom:1px solid #e2e8f0}
    h2{color:#4f46e5;font-size:24px}</style></head>
    <body>${content}</body></html>`);
    win.document.close();
    win.print();
}

// ── Create Invoice ────────────────────────────────────────────────────────────

async function openCreateInvoice() {
    try {
        [_invoiceCustomers, _invoiceProducts] = await Promise.all([api.getCustomers(), api.getProducts()]);
    } catch (err) {
        toast(err.message, "error"); return;
    }
    _invoiceLineItems = [{ id: Date.now(), product_id: null, description: "", hsn_sac: "", quantity: 1, unit_price: 0, tax_rate: 18 }];

    openModal("Create New Invoice", buildInvoiceForm(), true);
    renderLineItems();
}

function buildInvoiceForm() {
    return `
    <form id="invoice-form" onsubmit="submitInvoice(event)">
      <div class="form-row">
        <div class="form-group">
          <label>Customer *</label>
          <select id="if-customer" required>
            <option value="">Select customer…</option>
            ${_invoiceCustomers.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}
          </select>
        </div>
        <div class="form-group">
          <label>Supply Type</label>
          <select id="if-supply" onchange="renderLineItems()">
            <option value="intrastate">Intrastate (CGST + SGST)</option>
            <option value="interstate">Interstate (IGST)</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Invoice Date</label>
          <input type="date" id="if-date" value="${new Date().toISOString().split("T")[0]}" />
        </div>
        <div class="form-group">
          <label>Due Date</label>
          <input type="date" id="if-due" />
        </div>
      </div>

      <div style="margin:0.5rem 0 0.25rem;font-size:0.8rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em">Line Items</div>
      <div style="overflow-x:auto" id="line-items-wrap"></div>
      <button type="button" class="btn btn-ghost btn-sm mt-1" onclick="addLineItem()">+ Add Item</button>

      <div class="invoice-totals" id="invoice-totals-summary"></div>

      <div class="form-group mt-2">
        <label>Notes</label>
        <textarea id="if-notes" rows="2" placeholder="Optional notes for the customer…"></textarea>
      </div>
      <div id="invoice-form-error" class="form-error hidden"></div>
      <div class="modal-footer" style="padding:1rem 0 0">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Create Invoice</button>
      </div>
    </form>`;
}

function addLineItem() {
    _invoiceLineItems.push({ id: Date.now(), product_id: null, description: "", hsn_sac: "", quantity: 1, unit_price: 0, tax_rate: 18 });
    renderLineItems();
}

function removeLineItem(id) {
    _invoiceLineItems = _invoiceLineItems.filter(x => x.id !== id);
    renderLineItems();
}

function onProductSelect(lineId, productId) {
    const p = _invoiceProducts.find(x => x.id === parseInt(productId));
    const line = _invoiceLineItems.find(x => x.id === lineId);
    if (p && line) {
        line.product_id = p.id;
        line.description = p.name;
        line.hsn_sac = p.hsn_sac || "";
        line.unit_price = p.price;
        line.tax_rate = p.tax_rate;
    }
    renderLineItems();
}

function onLineChange(lineId, field, value) {
    const line = _invoiceLineItems.find(x => x.id === lineId);
    if (line) line[field] = field === "description" || field === "hsn_sac" ? value : parseFloat(value) || 0;
    recalcTotals();
}

function renderLineItems() {
    const supply = document.getElementById("if-supply")?.value || "intrastate";
    const isIntra = supply === "intrastate";
    const wrap = document.getElementById("line-items-wrap");
    if (!wrap) return;
    wrap.innerHTML = `
    <table class="invoice-items-table">
      <thead>
        <tr>
          <th style="min-width:150px">Product</th>
          <th style="min-width:160px">Description *</th>
          <th style="min-width:90px">HSN/SAC</th>
          <th style="min-width:70px">Qty</th>
          <th style="min-width:90px">Rate (₹)</th>
          <th style="min-width:70px">Tax%</th>
          <th style="min-width:90px">Amount</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${_invoiceLineItems.map(line => {
        const taxable = line.quantity * line.unit_price;
        const taxAmt = taxable * (line.tax_rate / 100);
        const total = taxable + taxAmt;
        return `
          <tr>
            <td>
              <select onchange="onProductSelect(${line.id}, this.value)" style="min-width:140px">
                <option value="">-- select --</option>
                ${_invoiceProducts.map(p => `<option value="${p.id}" ${line.product_id === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}
              </select>
            </td>
            <td><input type="text" value="${esc(line.description)}" placeholder="Description" required oninput="onLineChange(${line.id},'description',this.value)" style="min-width:150px"/></td>
            <td><input type="text" value="${esc(line.hsn_sac)}" placeholder="HSN/SAC" oninput="onLineChange(${line.id},'hsn_sac',this.value)" /></td>
            <td><input type="number" value="${line.quantity}" min="0.01" step="0.01" oninput="onLineChange(${line.id},'quantity',this.value)" /></td>
            <td><input type="number" value="${line.unit_price}" min="0" step="0.01" oninput="onLineChange(${line.id},'unit_price',this.value)" /></td>
            <td>
              <select onchange="onLineChange(${line.id},'tax_rate',this.value)">
                ${[0, 0.25, 3, 5, 12, 18, 28].map(r => `<option value="${r}" ${line.tax_rate === r ? "selected" : ""}>${r}%</option>`).join("")}
              </select>
            </td>
            <td style="font-weight:600">${fmt(total)}</td>
            <td><button type="button" class="btn btn-danger btn-sm btn-icon" onclick="removeLineItem(${line.id})">✕</button></td>
          </tr>`;
    }).join("")}
      </tbody>
    </table>`;
    recalcTotals();
}

function recalcTotals() {
    const supply = document.getElementById("if-supply")?.value || "intrastate";
    const isIntra = supply === "intrastate";
    let subtotal = 0, cgst = 0, sgst = 0, igst = 0;
    for (const line of _invoiceLineItems) {
        const taxable = line.quantity * line.unit_price;
        subtotal += taxable;
        if (isIntra) {
            cgst += taxable * (line.tax_rate / 2 / 100);
            sgst += taxable * (line.tax_rate / 2 / 100);
        } else {
            igst += taxable * (line.tax_rate / 100);
        }
    }
    const grand = subtotal + cgst + sgst + igst;
    const el = document.getElementById("invoice-totals-summary");
    if (!el) return;
    el.innerHTML = `
    <div class="invoice-total-row"><span class="text-secondary">Subtotal</span><span>${fmt(subtotal)}</span></div>
    ${isIntra
            ? `<div class="invoice-total-row"><span class="text-secondary">CGST</span><span>${fmt(cgst)}</span></div>
         <div class="invoice-total-row"><span class="text-secondary">SGST</span><span>${fmt(sgst)}</span></div>`
            : `<div class="invoice-total-row"><span class="text-secondary">IGST</span><span>${fmt(igst)}</span></div>`}
    <div class="invoice-total-row grand"><span>Grand Total</span><span>${fmt(grand)}</span></div>`;
}

async function submitInvoice(e) {
    e.preventDefault();
    const errEl = document.getElementById("invoice-form-error");
    errEl.classList.add("hidden");
    if (!_invoiceLineItems.length) {
        errEl.textContent = "Add at least one line item.";
        errEl.classList.remove("hidden");
        return;
    }
    const payload = {
        customer_id: parseInt(document.getElementById("if-customer").value),
        supply_type: document.getElementById("if-supply").value,
        invoice_date: document.getElementById("if-date").value || null,
        due_date: document.getElementById("if-due").value || null,
        notes: document.getElementById("if-notes").value.trim() || null,
        items: _invoiceLineItems.map(line => ({
            product_id: line.product_id || null,
            description: line.description,
            hsn_sac: line.hsn_sac || null,
            quantity: line.quantity,
            unit_price: line.unit_price,
            tax_rate: line.tax_rate,
        })),
    };
    try {
        const inv = await api.createInvoice(payload);
        closeModal();
        toast(`Invoice ${inv.invoice_number} created!`, "success");
        await loadInvoices();
    } catch (err) {
        errEl.textContent = err.message;
        errEl.classList.remove("hidden");
    }
}
