import { apiCall } from "../api.js";

export const salespersonApi = {
  dashboard: () => apiCall("/api/salesperson/dashboard"),
  Outlets: (params) => apiCall(`/api/salesperson/Outlets?${new URLSearchParams(params)}`),
  OutletDetail: (customerCode) => apiCall(`/api/salesperson/Outlets/${encodeURIComponent(customerCode)}`),
  markCollected: (body) => apiCall("/api/salesperson/collections", { method: "POST", body: JSON.stringify(body) }),
  collectionHistory: (params) => apiCall(`/api/salesperson/collections?${new URLSearchParams(params)}`),
  notifications: (params) => apiCall(`/api/salesperson/notifications?${new URLSearchParams(params)}`),
  markNotificationRead: (id) => apiCall(`/api/salesperson/notifications/${id}/read`, { method: "POST" }),
  profile: () => apiCall("/api/salesperson/profile"),
  addExplanation: (violationId, body) =>
    apiCall(`/api/violations/${violationId}/notes`, { method: "POST", body: JSON.stringify(body) }),
};