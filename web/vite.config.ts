import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Port 5173 matches CORS_ALLOWED_ORIGINS and the Auth0 SPA callback (§6.1, §6.5).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  preview: { port: 5173, strictPort: true },
});
