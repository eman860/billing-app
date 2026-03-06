/**
 * settings.js – Business profile / settings page.
 */

async function renderSettings() {
    const main = document.getElementById("main-content");
    main.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Settings</div>
        <div class="page-subtitle">Configure your business profile and invoice preferences</div>
      </div>
    </div>
    <div class="card" style="max-width:720px">
      <div class="card-header"><div class="card-title">⚙️ Business Profile</div></div>
      <div class="card-body" id="settings-body">
        <div class="page-loading"><div class="spinner"></div></div>
      </div>
    </div>`;
    await loadSettings();
}

async function loadSettings() {
    const body = document.getElementById("settings-body");
    try {
        const biz = await api.getBusiness();
        body.innerHTML = `
      <form id="settings-form" onsubmit="saveSettings(event)">
        <div class="settings-section">
          <div class="settings-group">
            <h4>Basic Information</h4>
            <div class="form-group">
              <label>Business Name *</label>
              <input type="text" id="sf-name" value="${esc(biz.name || "")}" required />
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Business Email</label>
                <input type="email" id="sf-email" value="${esc(biz.email || "")}" />
              </div>
              <div class="form-group">
                <label>Phone</label>
                <input type="tel" id="sf-phone" value="${esc(biz.phone || "")}" />
              </div>
            </div>
            <div class="form-group">
              <label>Address</label>
              <textarea id="sf-address" rows="2">${esc(biz.address || "")}</textarea>
            </div>
          </div>

          <div class="settings-group">
            <h4>GST Configuration</h4>
            <div class="form-row">
              <div class="form-group">
                <label>GSTIN</label>
                <input type="text" id="sf-gstin" value="${esc(biz.gstin || "")}" maxlength="15" placeholder="22AAAAA0000A1Z5" />
              </div>
              <div class="form-group">
                <label>State Code</label>
                <input type="text" id="sf-state" value="${esc(biz.state_code || "")}" maxlength="5" placeholder="e.g. 27 (Maharashtra)" />
              </div>
            </div>
          </div>

          <div class="settings-group">
            <h4>Invoice Numbering</h4>
            <div class="form-row">
              <div class="form-group">
                <label>Prefix</label>
                <input type="text" id="sf-prefix" value="${esc(biz.invoice_prefix || "INV")}" maxlength="10" />
              </div>
              <div class="form-group">
                <label>Current Counter</label>
                <input type="text" value="${biz.invoice_counter}" disabled style="opacity:0.5" title="Auto-managed" />
              </div>
            </div>
            <div class="text-muted" style="font-size:0.82rem">Next invoice will be: <strong>${esc(biz.invoice_prefix || "INV")}-${String(biz.invoice_counter).padStart(4, "0")}</strong></div>
          </div>

          <div id="settings-error" class="form-error hidden"></div>

          <div style="display:flex;gap:0.75rem;margin-top:0.5rem">
            <button type="submit" class="btn btn-primary">
              <span class="btn-text">Save Changes</span>
              <span class="btn-loader hidden">Saving…</span>
            </button>
          </div>
        </div>
      </form>

      <!-- Logo Upload -->
      <div class="settings-group" style="margin-top:1.5rem;padding-top:1.5rem;border-top:1px solid var(--border)">
        <h4>Business Logo</h4>
        ${biz.logo_url ? `<img src="http://localhost:8000${biz.logo_url}" style="height:64px;border-radius:8px;margin-bottom:0.75rem;border:1px solid var(--border)" />` : ""}
        <div class="form-group">
          <label>Upload Logo (PNG/JPG)</label>
          <input type="file" id="logo-file" accept="image/png,image/jpeg" onchange="uploadLogo()" style="color:var(--text-primary)" />
        </div>
        <div id="logo-status" class="text-secondary" style="font-size:0.85rem"></div>
      </div>`;
    } catch (err) {
        body.innerHTML = emptyState("⚠️", "Failed to load settings", err.message);
    }
}

async function saveSettings(e) {
    e.preventDefault();
    const btn = e.target.querySelector("button[type=submit]");
    const errEl = document.getElementById("settings-error");
    errEl.classList.add("hidden");
    setLoading(btn, true);
    const payload = {
        name: document.getElementById("sf-name").value.trim(),
        email: document.getElementById("sf-email").value.trim() || null,
        phone: document.getElementById("sf-phone").value.trim() || null,
        address: document.getElementById("sf-address").value.trim() || null,
        gstin: document.getElementById("sf-gstin").value.trim().toUpperCase() || null,
        state_code: document.getElementById("sf-state").value.trim() || null,
        invoice_prefix: document.getElementById("sf-prefix").value.trim() || "INV",
    };
    try {
        await api.updateBusiness(payload);
        toast("Settings saved!", "success");
    } catch (err) {
        errEl.textContent = err.message;
        errEl.classList.remove("hidden");
    } finally {
        setLoading(btn, false);
    }
}

async function uploadLogo() {
    const file = document.getElementById("logo-file").files[0];
    if (!file) return;
    const statusEl = document.getElementById("logo-status");
    statusEl.textContent = "Uploading…";
    const formData = new FormData();
    formData.append("file", file);
    try {
        const res = await fetch("http://localhost:8000/api/business/logo", {
            method: "POST",
            headers: { Authorization: `Bearer ${getToken()}` },
            body: formData,
        });
        if (!res.ok) throw new Error("Upload failed");
        const data = await res.json();
        statusEl.textContent = "✅ Logo uploaded!";
        toast("Logo uploaded!", "success");
    } catch (err) {
        statusEl.textContent = "❌ " + err.message;
    }
}
