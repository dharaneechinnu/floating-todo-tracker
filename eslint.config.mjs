import js from "@eslint/js";
import react from "eslint-plugin-react";

export default [
  { ignores: ["dist/**", "release/**", "node_modules/**", "landing/**", "docs/**"] },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx,cjs}"],
    plugins: { react },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { window: "readonly", document: "readonly" },
    },
    rules: {
      // Without this, ESLint's core no-unused-vars can't see that a
      // component imported for JSX (e.g. `<TodoPanel />`) is actually
      // used, and flags every such import as dead code.
      "react/jsx-uses-vars": "error",
    },
  },
  {
    files: ["electron/**/*.{js,cjs}", "scripts/**/*.{js,cjs}"],
    languageOptions: {
      sourceType: "commonjs",
      globals: {
        require: "readonly",
        module: "writable",
        exports: "writable",
        __dirname: "readonly",
        process: "readonly",
        console: "readonly",
      },
    },
  },
];
