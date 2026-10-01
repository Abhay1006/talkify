// Backend lint config. The frontend has its own in frontend/.eslintrc.cjs.
module.exports = {
  root: true,
  env: { node: true, es2022: true },
  extends: ["eslint:recommended"],
  parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  ignorePatterns: ["node_modules", "frontend"],
  rules: {
    "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrors: "none" }],
  },
};
