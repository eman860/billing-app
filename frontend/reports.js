/**
 * reports.js – Sales summary, GST report, customer-wise, aging report.
 */

async function renderReports() {
    const main = document.getElementById("main-content");
    main.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Reports</div>
        <div class="page-subtitle">Sales, GST, customer-wise, and aging analysis</div>
      </div>
      <div class="page-actions">
        <select id="rpt-month" class="btn btn-secondary" style="padding:0.55rem 1rem">
          <option value="">All Months</option>
          ${[["01", "January"], ["02", "February"], ["03", "March"], ["04", "April"], ["05", "May"], ["06", "June"],
        ["07", "July"], ["08", "August"], ["09", "September"], ["10", "October"], ["11", "November"], ["12", "December"]]
            .map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}
        </select>
        <select id="rpt-year" class="btn btn-secondary" style="padding:0.55rem 1rem">
          ${[2026, 2025, 2024, 2023].map(y => `<option value="${y}">${y}</option>`).join("")}
        </select>
        <button class="btn btn-primary" onclick="loadReports()">Apply</button>
      </div>
    </div>
    <div id="reports-body"><div class="page-loading"><div class="spinner"></div></div></div>`;
    await loadReports();
}

async function loadReports() {
    const month = document.getElementById("rpt-month")?.value;
    const year = document.getElementById("rpt-year")?.value;
    const body = document.getElementById("reports-body");
    body.innerHTML = `<div class="page-loading"><div class="spinner"></div></div>`;

    try {
        const [sales, gst, customers, aging] = await Promise.all([
            api.salesReport(),
            api.gstReport(month || null, year || null),
            api.customerReport(),
            api.agingReport(),
        ]);

        body.innerHTML = `
      <!-- Stats row -->
      <div class="stats-grid" style="margin-bottom:1.25rem">
        <div class="stat-card">
          <div class="stat-icon">🧾</div>
          <div class="stat-label">Total Invoices</div>
          <div class="stat-value">${sales.total_invoices}</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">💰</div>
          <div class="stat-label">Total Sales</div>
          <div class="stat-value" style="font-size:1.3rem">${fmt(sales.total_sales)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">✅</div>
          <div class="stat-label">Collected</div>
          <div class="stat-value text-green" style="font-size:1.3rem">${fmt(sales.total_paid)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">⏳</div>
          <div class="stat-label">Outstanding</div>
          <div class="stat-value text-amber" style="font-size:1.3rem">${fmt(sales.total_outstanding)}</div>
        </div>
      </div>

      <div class="reports-grid">
        <!-- GST Summary -->
        <div class="card">
          <div class="card-header"><div class="card-title">📑 GST Summary – ${gst.period}</div></div>
          <div class="card-body">
            <table class="gst-table">
              <tr><td class="text-secondary">Taxable Amount</td><td>${fmt(gst.total_taxable)}</td></tr>
              <tr><td class="text-secondary">CGST</td><td>${fmt(gst.total_cgst)}</td></tr>
              <tr><td class="text-secondary">SGST</td><td>${fmt(gst.total_sgst)}</td></tr>
              <tr><td class="text-secondary">IGST</td><td>${fmt(gst.total_igst)}</td></tr>
              <tr><td class="text-secondary font-bold">Total Tax</td><td class="text-green font-bold">${fmt(gst.total_tax)}</td></tr>
              <tr><td class="font-bold">Grand Total</td><td class="font-bold" style="color:var(--brand-light)">${fmt(gst.grand_total)}</td></tr>
            </table>
          </div>
        </div>

        <!-- Invoice Aging -->
        <div class="card">
          <div class="card-header"><div class="card-title">📅 Invoice Aging (Overdue)</div></div>
          <div class="card-body">
            ${aging.every(b => b.count === 0)
                ? `<div class="text-secondary" style="text-align:center;padding:2rem 0">🎉 No overdue invoices!</div>`
                : `<table class="gst-table">
                  ${aging.map(b => `
                  <tr>
                    <td class="text-secondary">${b.bucket} days</td>
                    <td>
                      <span class="badge ${b.bucket === "0-30" ? "badge-green" : b.bucket === "31-60" ? "badge-amber" : "badge-red"}">${b.count} inv</span>
                    </td>
                    <td class="${b.bucket === "90+" ? "text-red" : "text-amber"} font-bold">${fmt(b.amount)}</td>
                  </tr>`).join("")}
                </table>`}
          </div>
        </div>
      </div>

      <!-- Customer Report -->
      <div class="card" style="margin-top:1.25rem">
        <div class="card-header"><div class="card-title">👥 Customer-wise Report</div></div>
        <div class="card-body" style="padding:0">
          <div class="table-wrap">
            ${customers.length
                ? `<table>
                  <thead>
                    <tr><th>Customer</th><th>Invoices</th><th>Total Billed</th><th>Paid</th><th>Outstanding</th></tr>
                  </thead>
                  <tbody>
                    ${customers.map(c => `
                    <tr>
                      <td><strong>${esc(c.customer_name)}</strong></td>
                      <td>${c.total_invoices}</td>
                      <td>${fmt(c.total_billed)}</td>
                      <td class="text-green">${fmt(c.total_paid)}</td>
                      <td class="${c.outstanding > 0 ? "text-amber" : "text-green"} font-bold">${fmt(c.outstanding)}</td>
                    </tr>`).join("")}
                  </tbody>
                </table>`
                : emptyState("👥", "No customer data", "Create invoices to see customer reports.")}
          </div>
        </div>
      </div>`;
    } catch (err) {
        body.innerHTML = emptyState("⚠️", "Failed to load reports", err.message);
    }
}
