/**
 * api.js – Fetch wrapper for NeuraBills REST API.
 * Automatically injects JWT Bearer token and handles errors.
 */

const API_BASE = "http://localhost:8000";

// ── Token storage ─────────────────────────────────────────────────────────────

function getToken() {
  return localStorage.getItem("nb_token");
}

function setSession(data) {
  localStorage.setItem("nb_token", data.access_token);
  localStorage.setItem("nb_user_id", data.user_id);
  localStorage.setItem("nb_business_id", data.business_id);
  localStorage.setItem("nb_full_name", data.full_name);
}

function clearSession() {
  ["nb_token", "nb_user_id", "nb_business_id", "nb_full_name"].forEach(k => localStorage.removeItem(k));
}

function isLoggedIn() {
  return !!getToken();
}

// ── Core fetch helper ─────────────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    clearSession();
    location.reload();
    return;
  }

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      message = err.detail || JSON.stringify(err);
    } catch (_) {}
    throw new Error(message);
  }

  if (res.status === 204) return null;
  return res.json();
}

const api = {
  get:    (path)         => apiFetch(path, { method: "GET" }),
  post:   (path, body)   => apiFetch(path, { method: "POST",   body: JSON.stringify(body) }),
  put:    (path, body)   => apiFetch(path, { method: "PUT",    body: JSON.stringify(body) }),
  delete: (path)         => apiFetch(path, { method: "DELETE" }),

  // Auth
  login:    (data) => api.post("/api/auth/login", data),
  register: (data) => api.post("/api/auth/register", data),
  me:       ()     => api.get("/api/auth/me"),

  // Business
  getBusiness:    () =>       api.get("/api/business/profile"),
  updateBusiness: (data) =>   api.put("/api/business/profile", data),

  // Customers
  getCustomers:   (search) => api.get(`/api/customers${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  createCustomer: (data)   => api.post("/api/customers", data),
  updateCustomer: (id, d)  => api.put(`/api/customers/${id}`, d),
  deleteCustomer: (id)     => api.delete(`/api/customers/${id}`),

  // Products
  getProducts:   (search) => api.get(`/api/products${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  createProduct: (data)   => api.post("/api/products", data),
  updateProduct: (id, d)  => api.put(`/api/products/${id}`, d),
  deleteProduct: (id)     => api.delete(`/api/products/${id}`),

  // Invoices
  getInvoices:   (params) => api.get(`/api/invoices${buildQuery(params)}`),
  getInvoice:    (id)     => api.get(`/api/invoices/${id}`),
  createInvoice: (data)   => api.post("/api/invoices", data),
  updateStatus:  (id, s)  => api.put(`/api/invoices/${id}/status`, { status: s }),

  // Payments
  getPayments:   (params) => api.get(`/api/payments${buildQuery(params)}`),
  recordPayment: (data)   => api.post("/api/payments", data),

  // Reports
  salesReport:    () =>          api.get("/api/reports/sales"),
  gstReport:      (m, y) =>     api.get(`/api/reports/gst${m && y ? `?month=${m}&year=${y}` : ""}`),
  customerReport: () =>          api.get("/api/reports/customers"),
  agingReport:    () =>          api.get("/api/reports/aging"),
};

function buildQuery(params) {
  if (!params) return "";
  const q = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
  return q ? `?${q}` : "";
}
