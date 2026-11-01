// Integration tests: need DATABASE_URL, STORAGE_DIR, FFmpeg and a rendered video. Run: npx vitest run -c vitest.it.config.ts
import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  test: { include: ["tests/integration/**/*.itest.ts"], environment: "node", testTimeout: 300_000, fileParallelism: false },
  resolve: { alias: { "@": path.resolve(__dirname, "src"), "server-only": path.resolve(__dirname, "tests/server-only-stub.ts") } },
});
