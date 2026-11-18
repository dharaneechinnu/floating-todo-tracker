import { defineConfig } from "vitest/config";

// Unit tests for the desktop app. The landing site and the server are
// separate npm projects with their own test setup.
export default defineConfig({
  test: {
    include: ["test/**/*.test.{js,mjs}"],
    environment: "node",
  },
});
