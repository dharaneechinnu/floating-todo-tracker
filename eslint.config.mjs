import js from "@eslint/js";

export default [
  { ignores: ["dist/**", "release/**", "node_modules/**"] },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { window: "readonly", document: "readonly" },
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
