import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // 禁用过于严格的规则
      "react-hooks/set-state-in-effect": "off",
      // any 类型在某些场景下是合理的（如第三方库类型不完整时）
      "@typescript-eslint/no-explicit-any": "warn",
      // next/image 在 base64 data URL 场景下不适用
      "@next/next/no-img-element": "warn",
    },
  },
]);

export default eslintConfig;
