module.exports = {
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  rules: {
    // Prevent duplicate imports
    'no-duplicate-imports': 'error',
  },
  root: true,
};