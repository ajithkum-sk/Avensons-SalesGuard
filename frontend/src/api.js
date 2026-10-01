const BASE = import.meta.env.VITE_API_BASE ?? "";

function authHeader() {
  try {
    const raw = localStorage.getItem("sg_auth");
    if (!raw) return {};
    const { token } = JSON.parse(raw);
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

export async function apiCall(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...authHeader(), ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `${res.status} ${res.statusText}`);
  }
  return res.json();
}
const call = apiCall;

export const api = {
  dashboard: (runId, locationId) => {
    const params = new URLSearchParams();
    if (runId) params.set("run_id", runId);
    if (locationId) params.set("location_id", locationId);
    const qs = params.toString();
    return call(`/api/dashboard${qs ? `?${qs}` : ""}`);
  },
  violations: (params, locationId) => {
    const usp = new URLSearchParams(params);
    if (locationId) usp.set("location_id", locationId);
    return call(`/api/violations?${usp}`);
  },
  csvUrl: (params, locationId) => {
    const usp = new URLSearchParams(params);
    if (locationId) usp.set("location_id", locationId);
    return `${BASE}/api/violations.csv?${usp}`;
  },
  customer: (code) => call(`/api/customers/${encodeURIComponent(code)}`),
  salesmen: (locationId) => call(`/api/salesmen${locationId ? `?location_id=${locationId}` : ""}`),
  salesmenMonthly: (month) => call(`/api/salesmen/monthly?month=${month}`),
  rules: () => call("/api/rules"),
  patchRule: (code, body) => call(`/api/rules/${code}`, { method: "PATCH", body: JSON.stringify(body) }),
  config: () => call("/api/config"),
  putConfig: (params) => call("/api/config", { method: "PUT", body: JSON.stringify({ params }) }),
  snapshots: () => call("/api/snapshots"),
  deleteSnapshot: (id) => call(`/api/snapshots/${id}`, { method: "DELETE" }),
  locations: () => call("/api/masters/locations"),
  addLocation: (name) => call(`/api/masters/locations?${new URLSearchParams({ name })}`, { method: "POST" }),
  deleteLocation: (id) => call(`/api/masters/locations/${id}`, { method: "DELETE" }),
  runs: () => call("/api/runs"),
  createRun: (body = {}) => call("/api/runs", { method: "POST", body: JSON.stringify(body) }),
  exceptions: () => call("/api/exceptions"),
  addException: (body) => call("/api/exceptions", { method: "POST", body: JSON.stringify(body) }),
  dropException: (id) => call(`/api/exceptions/${id}`, { method: "DELETE" }),
  addNote: (violationId, body) =>
    call(`/api/violations/${violationId}/notes`, { method: "POST", body: JSON.stringify(body) }),
  upload: async (file, { snapshotType = "daily", snapshotDate = "", locationId = "" } = {}) => {
    const form = new FormData();
    form.append("file", file);
    form.append("snapshot_type", snapshotType);
    if (snapshotDate) form.append("snapshot_date", snapshotDate);
    if (locationId) form.append("location_id", locationId);
    const res = await fetch(`${BASE}/api/snapshots/upload`, { method: "POST", body: form, headers: { ...authHeader() } });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || "Upload failed");
    }
    return res.json();
  },
};

export const money = (n) =>
  n == null ? "—" : `\u20B9${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
export const count = (n) => (n == null ? "—" : Number(n).toLocaleString("en-IN"));
