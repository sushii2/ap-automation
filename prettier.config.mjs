import config from "ultracite/prettier";

export default {
  ...config,
  // Carried over from the previous .prettierrc.
  endOfLine: "lf",
  plugins: ["prettier-plugin-tailwindcss"],
  tailwindStylesheet: "packages/ui/src/styles/globals.css",
};
