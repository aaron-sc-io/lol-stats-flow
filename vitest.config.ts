import { fileURLToPath, URL } from "node:url"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
    projects: [
      {
        test: {
          name: "component",
          environment: "jsdom",
          setupFiles: ["./src/test-setup.ts"],
          include: ["src/**/*.test.{ts,tsx}"],
        },
      },
      {
        test: {
          name: "node",
          environment: "node",
          include: ["scripts/**/*.test.ts"],
        },
      },
    ],
  },
})
