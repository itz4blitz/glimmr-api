import { config as baseConfig } from "./base.js";
import tseslint from "typescript-eslint";

/**
 * ESLint configuration for NestJS backend applications.
 * Extends the base configuration with NestJS-specific rules.
 * 
 * @type {import("eslint").Linter.Config[]}
 */
export const config = [
  ...baseConfig,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: true,
        tsconfigRootDir: process.cwd(),
        sourceType: "module",
      },
      globals: {
        NodeJS: true,
        Express: true,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      // NestJS specific rules
      "@typescript-eslint/interface-name-prefix": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      
      // Import rules
      "no-duplicate-imports": "error",
      
      // Node.js specific
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
      "no-process-exit": "error",
      
      // General best practices for backend
      "no-throw-literal": "error",
      "prefer-promise-reject-errors": "error",
      "require-await": "error",
      
      // Disable some rules that don't make sense for NestJS
      "class-methods-use-this": "off",
      "no-useless-constructor": "off",
      "@typescript-eslint/no-useless-constructor": "error",
    },
  },
  {
    files: ["**/*.spec.ts", "**/*.e2e-spec.ts", "**/test/**/*.ts"],
    rules: {
      // Relax rules for test files
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "off",
    },
  },
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
      ".eslintrc.js",
      "jest.config.js",
      "webpack*.config.js",
    ],
  },
];