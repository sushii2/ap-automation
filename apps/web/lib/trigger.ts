import "server-only";

import { configure } from "@trigger.dev/sdk";

// On Vercel preview deployments the SDK picks up VERCEL_GIT_COMMIT_REF and sends
// it as a Trigger.dev preview branch. Only preview keys (`tr_preview_…`) have
// branches; with any other key the API answers 401 "No matching branch env".
// An empty branch stops the SDK from sending one. Import this module from every
// server file that calls the Trigger.dev API.
const secretKey = process.env.TRIGGER_SECRET_KEY;
if (secretKey && !secretKey.startsWith("tr_preview_")) {
  configure({ accessToken: secretKey, previewBranch: "" });
}
