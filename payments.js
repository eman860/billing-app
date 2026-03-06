/**
 * payments.js – Payment recording and listing.
 */

let _paymentInvoices = [];

async function renderPayments() {
    const main = document.getElementById("main-content");
    main.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Payments</div>
        <div class="page-subtitle">Record and track invoice payments</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" onclick="openPaymentModal()">+ Record Payment</button>
      </div>
    </div>
    <div class="card">
      <div class="card-body" style="padding:0">
        <div class="table-wrap" id="payments-table-wrap">
          <div class="page-loading"><div class="spinner"></div></div>
        </div>
      </div>
    </div>`;
    await loadPayments();
}

async function loadPayments() {
    try {
        const payments = await api.getPayments();
        renderPaymentTable(payments);
    } catch (err) {
        document.getElementById("payments-table-wrap").innerHTML =
            emptyState("⚠️", "Failed to load", err.message);
    }
}

function renderPaymentTable(payments) {
    const wrap = document.getElementById("payments-table-wrap");
    if (!payments.length) {
        wrap.innerHTML = emptyState("💳", "No payments recorded", "Record a payment against an invoice.",
            `<button class="btn btn-primary" onclick="openPaymentModal()">+ Record Payment</button>`);
        return;
    }
    wrap.innerHTML = `
    <table>
      <thead>
        <tr><th>Invoice</th><th>Date</th><th>Method</th><th>Amount</th><th>Notes</th></tr>
      </thead>
      <tbody>
        ${payments.map(p => `
        <tr>
          <td><strong style="color:var(--brand-light)">#${p.invoice_id}</strong></td>
          <td class="text-secondary">${fmtDate(p.payment_date)}</td>
          <td><span class="badge badge-blue">${esc(p.method)}</span></td>
          <td><strong class="text-green">${fmt(p.amount)}</strong></td>
          <td class="text-secondary">${esc(p.notes || "—")}</td>
        </tr>`).join("")}
      </tbody>
    </table>`;
}

async function openPaymentModal(preInvoiceId) {
    try {
        // Fetch unpaid/sent invoices
        const all = await api.getInvoices();
        _paymentInvoices = all.filter(i => i.outstanding > 0.01);
    } catch (err) {
        toast(err.message, "error"); return;
    }

    if (!_paymentInvoices.length) {
        toast("No outstanding invoices to pay!", "info");
        return;
    }

    openModal("Record Payment", `
    <form id="payment-form" onsubmit="submitPayment(event)">
      <div class="form-group">
        <label>Invoice *</label>
        <select id="pmt-invoice" required onchange="updateOutstanding()">
          <option value="">Select invoice…</option>
          ${_paymentInvoices.map(i => `
            <option value="${i.id}" data-outstanding="${i.outstanding}" ${preInvoiceId == i.id ? "selected" : ""}>
              ${esc(i.invoice_number)} – ${esc(i.customer_name || "")} (Outstanding: ${fmt(i.outstanding)})
            </option>`).join("")}
        </select>
      </div>
      <div id="outstanding-info" class="form-error" style="background:rgba(99,102,241,0.1);border-color:rgba(99,102,241,0.3);color:var(--brand-light);display:none">
        Outstanding: <strong id="outstanding-amount">—</strong>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Amount (₹) *</label>
          <input type="number" id="pmt-amount" min="0.01" step="0.01" required placeholder="0.00" />
        </div>
        <div class="form-group">
          <label>Payment Method</label>
          <select id="pmt-method">
            ${["cash", "upi", "bank", "card", "cheque", "other"].map(m =>
        `<option value="${m}">${m.charAt(0).toUpperCase() + m.slice(1)}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Date</label>
        <input type="date" id="pmt-date" value="${new Date().toISOString().split("T")[0]}" />
      </div>
      <div class="form-group">
        <label>Notes</label>
        <textarea id="pmt-notes" rows="2" placeholder="Optional reference or notes…"></textarea>
      </div>
      <div id="payment-form-error" class="form-error hidden"></div>
      <div class="modal-footer" style="padding:1rem 0 0">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Record Payment</button>
      </div>
    </form>`);

    if (preInvoiceId) updateOutstanding();
}

function updateOutstanding() {
    const sel = document.getElementById("pmt-invoice");
    const info = document.getElementById("outstanding-info");
    const opt = sel.options[sel.selectedIndex];
    if (!opt || !opt.dataset.outstanding) { info.style.display = "none"; return; }
    info.style.display = "block";
    const outstanding = parseFloat(opt.dataset.outstanding);
    document.getElementById("outstanding-amount").textContent = fmt(outstanding);
    document.getElementById("pmt-amount").max = outstanding;
    document.getElementById("pmt-amount").value = outstanding.toFixed(2);
}

async function submitPayment(e) {
    e.preventDefault();
    const errEl = document.getElementById("payment-form-error");
    errEl.classList.add("hidden");
    const payload = {
        invoice_id: parseInt(document.getElementById("pmt-invoice").value),
        amount: parseFloat(document.getElementById("pmt-amount").value),
        payment_date: document.getElementById("pmt-date").value || null,
        method: document.getElementById("pmt-method").value,
        notes: document.getElementById("pmt-notes").value.trim() || null,
    };
    try {
        await api.recordPayment(payload);
        toast("Payment recorded!", "success");
        closeModal();
        await loadPayments();
    } catch (err) {
        errEl.textContent = err.message;
        errEl.classList.remove("hidden");
    }
}
