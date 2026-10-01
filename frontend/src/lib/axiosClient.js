import axios from "axios";

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE ?? "",
  headers: { "Content-Type": "application/json" },
});

client.interceptors.request.use((config) => {
  const raw = localStorage.getItem("sg_auth");
  if (raw) {
    const { token } = JSON.parse(raw);
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => Promise.reject(new Error(err.response?.data?.detail || err.message))
);

export default client;