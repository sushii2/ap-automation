import config from "ultracite/stylelint";

export default {
  ...config,
  // Trigger.dev build output: gitignored, and not in Ultracite's ignore list.
  ignoreFiles: [...config.ignoreFiles, "**/.trigger", "**/.trigger/**"],
};
