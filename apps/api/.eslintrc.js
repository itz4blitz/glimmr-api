module.exports = {
  root: true,
  extends: ['../../packages/eslint-config/backend.js'],
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  env: {
    node: true,
    jest: true,
  },
  globals: {
    module: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.js', 'src/__mocks__/**/*.js'],
  overrides: [
    {
      files: ['**/*.js'],
      env: {
        node: true,
        jest: true,
      },
      globals: {
        module: true,
        jest: true,
      },
    },
  ],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
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