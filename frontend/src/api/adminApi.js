import { apiCall } from "../api.js";

export const adminApi = {
  overview: () => apiCall("/api/admin/overview"),
  users: (params) => apiCall(`/api/admin/users?${new URLSearchParams(params)}`),
  createUser: (body) => apiCall("/api/admin/users", { method: "POST", body: JSON.stringify(body) }),
  updateUser: (id, body) => apiCall(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  setUserActive: (id, active) =>
    apiCall(`/api/admin/users/${id}/active`, { method: "PATCH", body: JSON.stringify({ active }) }),
  resetUserPassword: (id) => apiCall(`/api/admin/users/${id}/reset-password`, { method: "POST" }),
};