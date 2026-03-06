/**
 * app.js – Core SPA router, auth handlers, toast, modal utilities.
 */

// ── State ─────────────────────────────────────────────────────────────────────
let currentPage = "dashboard";

// ── Init ──────────────────────────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
    if (isLoggedIn()) {
        showApp();
    } else {
        document.getElementById("auth-overlay").classList.remove("hidden");
    }
});

function showApp() {
    document.getElementById("auth-overlay").classList.add("hidden");
    document.getElementById("app-shell").classList.remove("hidden");
    const name = localStorage.getItem("nb_full_name") || "User";
    document.getElementById("user-name-sidebar").textContent = name;
    document.getElementById("user-avatar").textContent = name.charAt(0).toUpperCase();
    navigate("dashboard");
}

// ── Auth Tab ──────────────────────────────────────────────────────────────────
function showAuthTab(tab) {
    document.getElementById("login-form").classList.toggle("hidden", tab !== "login");
    document.getElementById("register-form").classList.toggle("hidden", tab !== "register");
    document.getElementById("tab-login").classList.toggle("active", tab === "login");
    document.getElementById("tab-register").classList.toggle("active", tab === "register");
}

// ── Auth Handlers ─────────────────────────────────────────────────────────────
async function handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById("login-btn");
    const errEl = document.getElementById("login-error");
    errEl.classList.add("hidden");
    setLoading(btn, true);
    try {
        const data = await api.login({
            email: document.getElementById("login-email").value.trim(),
            password: document.getElementById("login-password").value,
        });
        setSession(data);
        showApp();
    } catch (err) {
        errEl.textContent = err.message;
        errEl.classList.remove("hidden");
    } finally {
        setLoading(btn, false);
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const btn = document.getElementById("register-btn");
    const errEl = document.getElementById("register-error");
    errEl.classList.add("hidden");
    setLoading(btn, true);
    try {
        const data = await api.register({
            full_name: document.getElementById("reg-name").value.trim(),
            email: document.getElementById("reg-email").value.trim(),
            business_name: document.getElementById("reg-business").value.trim(),
            password: document.getElementById("reg-password").value,
        });
        setSession(data);
        showApp();
    } catch (err) {
        errEl.textContent = err.message;
        errEl.classList.remove("hidden");
    } finally {
        setLoading(btn, false);
    }
}

function logout() {
    clearSession();
    location.reload();
}

// ── Router ────────────────────────────────────────────────────────────────────
function navigate(page, el) {
    currentPage = page;
    document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
    if (el) el.classList.add("active");
    else {
        const target = document.querySelector(`.nav-item[data-page="${page}"]`);
        if (target) target.classList.add("active");
    }
    const main = document.getElementById("main-content");
    main.innerHTML = `<div class="page-loading"><div class="spinner"></div></div>`;
    const renderers = {
        dashboard: renderDashboard,
        customers: renderCustomers,
        products: renderProducts,
        invoices: renderInvoices,
        payments: renderPayments,
        reports: renderReports,
        settings: renderSettings,
    };
    (renderers[page] || renderDashboard)();
    return false;
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function openModal(title, bodyHTML, large = false) {
    document.getElementById("modal-title").textContent = title;
    document.getElementById("modal-body").innerHTML = bodyHTML;
    const modal = document.getElementById("modal");
    modal.classList.toggle("modal-lg", large);
    document.getElementById("modal-overlay").classList.remove("hidden");
}

function closeModal() {
    document.getElementById("modal-overlay").classList.add("hidden");
    document.getElementById("modal-body").innerHTML = "";
}

function closeModalOnBackdrop(e) {
    if (e.target === document.getElementById("modal-overlay")) closeModal();
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function toast(msg, type = "info") {
    const icons = { success: "✅", error: "❌", info: "ℹ️" };
    const el = document.createElement("div");
    el.className = `toast toast-${type}`;
    el.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
    document.getElementById("toast-container").prepend(el);
    setTimeout(() => el.remove(), 3500);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function setLoading(btn, loading) {
    btn.querySelector(".btn-text").classList.toggle("hidden", loading);
    btn.querySelector(".btn-loader").classList.toggle("hidden", !loading);
    btn.disabled = loading;
}

function fmt(n) {
    return "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function statusBadge(s) {
    const cls = { draft: "badge-draft", sent: "badge-sent", paid: "badge-paid" };
    return `<span class="badge ${cls[s] || "badge-draft"}">${s}</span>`;
}

function emptyState(icon, title, sub, btnHTML = "") {
    return `<div class="empty-state">
    <div class="empty-icon">${icon}</div>
    <div class="empty-title">${title}</div>
    <div class="empty-sub">${sub}</div>
    ${btnHTML}
  </div>`;
}

function pageShell(titleHTML, actionsHTML, bodyHTML) {
    return `<div class="page-header">${titleHTML}</div>${bodyHTML}`;
}
