import path from "node:path"
import { fileURLToPath } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

const root = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return
          }

          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("/scheduler/")
          ) {
            return "react-vendor"
          }

          if (id.includes("/streamdown/")) {
            return "markdown-vendor"
          }
        },
      },
    },
  },
  plugins: [
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler"]],
      },
    }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(root, "./src"),
      // Worker builds may resolve the package "node" export; that bundle pulls
      // onnxruntime-node/sharp and crashes in the browser. Force the web entry.
      "@huggingface/transformers": path.resolve(
        root,
        "node_modules/@huggingface/transformers/dist/transformers.web.js"
      ),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
  },
})
