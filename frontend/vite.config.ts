import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import netlify from "@netlify/vite-plugin-tanstack-start";

export default defineConfig(({ command }) => ({
  plugins: [
    tailwindcss(),
    tanstackStart({
      server: { entry: "./src/server.ts" },
    }),
    react(),
    ...(command === "build" || process.env.NETLIFY ? [netlify()] : []),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    port: 3001,
    proxy: {
      // Proxy all /api/* requests to the Express backend.
      // This avoids CORS entirely — the browser only ever talks to :3001.
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false,
        timeout: 300000,
        proxyTimeout: 300000,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("react-dom") || id.includes("react/")) {
              return "vendor-react";
            }
            if (id.includes("@tanstack")) {
              return "vendor-tanstack";
            }
            if (id.includes("framer-motion")) {
              return "vendor-motion";
            }
            if (id.includes("lucide-react")) {
              return "vendor-icons";
            }
            if (id.includes("@radix-ui")) {
              return "vendor-radix";
            }
          }
        },
      },
    },
  },
}));
