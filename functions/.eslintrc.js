module.exports = {
  env: {
    es6: true,
    node: true,
  },
  parser: "espree",
  parserOptions: {
    "ecmaVersion": 2018,
  },
  extends: [
    "eslint:recommended",
    "google",
  ],
  rules: {
    "no-restricted-globals": ["error", "name", "length"],
    "prefer-arrow-callback": "error",
    "quotes": ["error", "double", {"allowTemplateLiterals": true}],
    "valid-jsdoc": "off",
    "require-jsdoc": "off",
    // Disable any potential TypeScript-related rules that might be bleeding through
    "@typescript-eslint/no-require-imports": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "no-unused-vars": "off", // Disable for now due to placeholder functions
    "max-len": "off", // Disable for now due to placeholder functions
  },
  overrides: [
    {
      files: ["**/*.spec.*"],
      env: {
        mocha: true,
      },
      rules: {},
    },
  ],
  globals: {},
};
