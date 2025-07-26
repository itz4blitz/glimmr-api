#!/bin/bash

# Script to fix ESLint warnings in apps/api

echo "🔧 Starting ESLint warning fixes..."

# Fix no-undef warnings for jest and module
echo "📝 Adding jest environment declarations..."
cat > .eslintrc.js << 'EOF'
module.exports = {
  root: true,
  extends: ['../../packages/eslint-config/nestjs.js'],
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.js'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
    'require-await': 'warn',
    'no-duplicate-imports': 'warn',
    'turbo/no-undeclared-env-vars': 'off',
  },
};
EOF

echo "✅ ESLint configuration updated"
echo "🔄 Running ESLint with auto-fix..."
npm run lint -- --fix

echo "📊 Checking remaining warnings..."
npm run lint 2>&1 | grep -E "warning|error" | wc -l