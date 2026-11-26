/* eslint-disable import-x/no-extraneous-dependencies, import-x/no-relative-packages -- imports the presets and config of the root package */
import react from "ultracite/eslint/react";

import root from "../../eslint.config.mjs";

// ESLint lints each file with its nearest config alone, so this spreads the
// root config before the workspace's presets.
export default [...root, ...react];
