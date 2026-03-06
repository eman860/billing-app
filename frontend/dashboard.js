/**
 * dashboard.js – Dashboard page renderer.
 */

async function renderDashboard() {
    const main = document.getElementById("main-content");
    try {
        const [sales, gst] = await Promise.all([api.salesReport(), api.gstReport()]);
        main.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">Dashboard</div>
          <div class="page-subtitle">Welcome back, ${localStorage.getItem("nb_full_name") || ""}! Here's your business overview.</div>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">🧾</div>
          <div class="stat-label">Total Invoices</div>
          <div class="stat-value">${sales.total_invoices}</div>
          <div class="stat-sub">${sales.paid_count} paid · ${sales.sent_count} sent · ${sales.draft_count} draft</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">💰</div>
          <div class="stat-label">Total Sales</div>
          <div class="stat-value" style="font-size:1.4rem">${fmt(sales.total_sales)}</div>
          <div class="stat-sub">Gross billed amount</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">✅</div>
          <div class="stat-label">Amount Collected</div>
          <div class="stat-value text-green" style="font-size:1.4rem">${fmt(sales.total_paid)}</div>
          <div class="stat-sub">Payments received</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">⏳</div>
          <div class="stat-label">Outstanding</div>
          <div class="stat-value text-amber" style="font-size:1.4rem">${fmt(sales.total_outstanding)}</div>
          <div class="stat-sub">Balance pending</div>
        </div>
      </div>

      <div class="reports-grid">
        <div class="card">
          <div class="card-header"><div class="card-title">📑 GST Summary (All Time)</div></div>
          <div class="card-body">
            <table class="gst-table">
              <tr><td class="text-secondary">Taxable Amount</td><td>${fmt(gst.total_taxable)}</td></tr>
              <tr><td class="text-secondary">CGST</td><td>${fmt(gst.total_cgst)}</td></tr>
              <tr><td class="text-secondary">SGST</td><td>${fmt(gst.total_sgst)}</td></tr>
              <tr><td class="text-secondary">IGST</td><td>${fmt(gst.total_igst)}</td></tr>
              <tr><td class="text-secondary font-bold">Total Tax</td><td class="font-bold text-green">${fmt(gst.total_tax)}</td></tr>
              <tr><td class="text-secondary font-bold">Grand Total</td><td class="font-bold" style="color:var(--brand-light)">${fmt(gst.grand_total)}</td></tr>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><div class="card-title">📊 Invoice Status Breakdown</div></div>
          <div class="card-body">
            <div style="display:flex;flex-direction:column;gap:0.85rem;margin-top:0.25rem">
              ${statusBar("Paid", sales.paid_count, sales.total_invoices, "var(--accent-green)")}
              ${statusBar("Sent", sales.sent_count, sales.total_invoices, "var(--accent-blue)")}
              ${statusBar("Draft", sales.draft_count, sales.total_invoices, "var(--text-muted)")}
            </div>
            <div style="margin-top:1.5rem;display:flex;gap:1rem;flex-wrap:wrap">
              <button class="btn btn-primary btn-sm" onclick="navigate('invoices')">View Invoices →</button>
              <button class="btn btn-secondary btn-sm" onclick="navigate('reports')">Full Reports →</button>
            </div>
          </div>
        </div>
      </div>
    `;
    } catch (err) {
        main.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Could not load dashboard</div><div class="empty-sub">${err.message}</div></div>`;
    }
}

function statusBar(label, count, total, color) {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return `
    <div>
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:0.85rem">
        <span class="text-secondary">${label}</span>
        <span style="font-weight:600">${count} <span class="text-muted">(${pct}%)</span></span>
      </div>
      <div style="background:var(--bg-base);border-radius:4px;height:8px;overflow:hidden">
        <div style="width:${pct}%;height:100%;background:${color};border-radius:4px;transition:width 0.5s ease"></div>
      </div>
    </div>`;
}
