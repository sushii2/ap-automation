import plugin from "eslint-plugin-turbo";
import core from "ultracite/eslint/core";

export default [
  ...core,
  // Trigger.dev build output: gitignored, and not in Ultracite's ignore list.
  {
    ignores: ["**/.trigger"],
  },
  // sonarjs/no-empty-test-file reports every file that has no test cases. It
  // is a test-file rule, so keep it for test files only.
  {
    ignores: [
      "**/*.{test,spec}.{ts,tsx,js,jsx,mts,cts,mjs,cjs}",
      "**/__tests__/**",
    ],
    rules: {
      "sonarjs/no-empty-test-file": "off",
    },
  },
  // Carried over from the previous @workspace/eslint-config base config.
  {
    plugins: {
      turbo: plugin,
    },
    rules: {
      "turbo/no-undeclared-env-vars": "warn",
    },
  },
];
