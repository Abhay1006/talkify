module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react/jsx-runtime",
    "plugin:react-hooks/recommended",
  ],
  ignorePatterns: ["dist", ".eslintrc.cjs"],
  parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  settings: { react: { version: "detect" } },
  plugins: ["react", "react-hooks"],
  rules: {
    "react/jsx-no-target-blank": "off",
    "react/prop-types": "off",
  },
};
