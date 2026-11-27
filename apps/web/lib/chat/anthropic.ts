import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { env } from "@/lib/env";

/**
 * The Claude Managed Agents resources behind the invoice chat, or null when
 * the deployment has not been set up for it (see `npm run chat:agent -w web`).
 */
export const getChatConfig = () => {
  const {
    ANTHROPIC_API_KEY: apiKey,
    CHAT_AGENT_ID: agentId,
    CHAT_ENVIRONMENT_ID: environmentId,
  } = env;
  return apiKey && agentId && environmentId
    ? { agentId, apiKey, environmentId }
    : null;
};

const cache: { client?: Anthropic } = {};

/**
 * Talks to Anthropic directly: Managed Agents is not available through the AI Gateway the ingestion pipeline uses.
 */
export const getAnthropic = () => {
  cache.client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return cache.client;
};
