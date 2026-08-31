import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "happy-dom",
    globals: true,
    include: ["__tests__/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next"],
    coverage: {
      reporter: ["text", "html"],
      exclude: ["node_modules", ".next", "**/*.d.ts", "**/*.config.*"],
    },
    setupFiles: ["./__tests__/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
      // Vitest does not set the "react-server" export condition, so the real
      // entry point throws on import. The package ships the no-op the RSC
      // condition would have resolved to; point at it directly.
      "server-only": path.resolve(__dirname, "./node_modules/server-only/empty.js"),
    },
  },
});
