import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // the API stays on 8001; no CORS juggling during development
    proxy: { "/api": "http://192.168.123.31:8001" },
  },
});
