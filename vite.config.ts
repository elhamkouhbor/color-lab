import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // "/" locally; "/color-lab/" for GitHub Pages (npm run build:pages)
  base: process.env.ELHAM_BASE || "/",
  server: { port: 5190 },
  preview: { port: 5191 },
  build: { sourcemap: false, target: "es2022" },
  worker: { format: "es" },
});
