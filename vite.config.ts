import path from "node:path";
import { fileURLToPath } from "node:url";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "react-vendor",
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
            },
            {
              name: "markdown-vendor",
              test: /[\\/]node_modules[\\/]streamdown[\\/]/,
            },
          ],
        },
      },
    },
  },
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(root, "./src"),
      // Worker builds may resolve the package "node" export; that bundle pulls
      // onnxruntime-node/sharp and crashes in the browser. Force the web entry.
      "@huggingface/transformers": path.resolve(
        root,
        "node_modules/@huggingface/transformers/dist/transformers.web.js",
      ),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
  },
});
