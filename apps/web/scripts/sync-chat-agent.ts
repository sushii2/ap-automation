// Creates or updates the invoice chat agent and its sandbox environment in Claude Managed Agents, from lib/chat/agent-config.ts. Safe to re-run: with CHAT_AGENT_ID / CHAT_ENVIRONMENT_ID set it updates those, otherwise it creates new ones and prints the IDs to add to the environment.
// Usage: npm run chat:agent -w web
import Anthropic from "@anthropic-ai/sdk";

import { AGENT_CONFIG, ENVIRONMENT_CONFIG } from "../lib/chat/agent-config.ts";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error(
    "ANTHROPIC_API_KEY is not set (expected in apps/web/.env.local)"
  );
  process.exit(1);
}

const client = new Anthropic();
const created: string[] = [];

const environmentId = process.env.CHAT_ENVIRONMENT_ID;
if (environmentId) {
  await client.beta.environments.update(environmentId, ENVIRONMENT_CONFIG);
  console.log(`= environment ${environmentId} (updated)`);
} else {
  const environment =
    await client.beta.environments.create(ENVIRONMENT_CONFIG);
  console.log(`+ environment ${environment.id}`);
  created.push(`CHAT_ENVIRONMENT_ID=${environment.id}`);
}

const agentId = process.env.CHAT_AGENT_ID;
if (agentId) {
  // An update must name the version it replaces. New chats use the new
  // version; chats already open keep the one they started with.
  const { version } = await client.beta.agents.retrieve(agentId);
  const agent = await client.beta.agents.update(agentId, {
    ...AGENT_CONFIG,
    version,
  });
  console.log(`= agent ${agentId} (now version ${agent.version})`);
} else {
  const agent = await client.beta.agents.create(AGENT_CONFIG);
  console.log(`+ agent ${agent.id}`);
  created.push(`CHAT_AGENT_ID=${agent.id}`);
}

if (created.length > 0) {
  console.log(
    `\nAdd to apps/web/.env.local and to the deployment's environment:\n${created.join("\n")}`
  );
}
