import js from "@eslint/js";
import ts from "typescript-eslint";
import hooks from "eslint-plugin-react-hooks";
export default ts.config(
  {
    ignores: [
      "dist",
      "dist-*/**",
      "node_modules",
      "playwright-report",
      "test-results",
      "public/ocr/**",
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": hooks },
    rules: { ...hooks.configs.recommended.rules },
  },
  { files: ["**/*.js"], languageOptions: { globals: { process: "readonly" } } },
);
