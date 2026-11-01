import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// If your code lives in a `src/` folder, change "./" below to "./src/".
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: { provider: "v8", include: ["lib/**/*.ts", "app/api/**/*.ts"], reporter: ["text", "html"] }
  }
});
