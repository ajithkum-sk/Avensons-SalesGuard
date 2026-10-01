import client from "../lib/axiosClient.js";

export const authApi = {
  login: (email, password, role) =>
    client.post("/api/auth/login", { email, password, role }).then((r) => r.data),
  forgotPassword: (email) =>
    client.post("/api/auth/forgot-password", { email }).then((r) => r.data),
  resetPassword: (token, newPassword) =>
    client.post("/api/auth/reset-password", { token, new_password: newPassword }).then((r) => r.data),
};