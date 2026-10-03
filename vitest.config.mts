import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts", "tests/unit/**/*.test.ts", "tests/engine/**/*.test.ts"],
    environment: "node",
    setupFiles: ["./tests/setup-env.ts"],
    // DB integration tests share one database, so run files one at a time.
    fileParallelism: false,
    coverage: { include: ["src/engine/**", "src/lib/**"] },
  },
});
