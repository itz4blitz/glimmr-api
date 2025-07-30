import { config as backendConfig } from "@repo/eslint-config/backend";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default [
  ...backendConfig,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      // Disable turbo env vars warning since we handle env vars differently
      "turbo/no-undeclared-env-vars": "off",
      // Change errors to warnings for gradual migration
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "require-await": "warn",
      "no-duplicate-imports": "warn",
    },
  },
  {
    files: ["scripts/**/*.ts", "test/**/*.ts"],
    languageOptions: {
      parserOptions: {
        // Use program option instead of project for files outside tsconfig
        programs: null,
        project: false,
      },
    },
    rules: {
      // Relax rules for scripts and tests
      "no-console": "off",
      "no-process-exit": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "turbo/no-undeclared-env-vars": "off",
    },
  },
  {
    files: ["src/database/seeds/**/*.ts"],
    rules: {
      // Allow console in seed files
      "no-console": "off",
      "no-process-exit": "off",
      "turbo/no-undeclared-env-vars": "off",
    },
  },
  {
    files: ["src/__mocks__/**/*.js"],
    languageOptions: {
      globals: {
        module: true,
        jest: true,
      },
    },
    rules: {
      "no-undef": "off",
    },
  },
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
      "*.config.js",
      "*.config.mjs",
      "*.config.ts",
      "src/database/migrations/**",
      "scripts/**/*.js",
    ],
  },
];
