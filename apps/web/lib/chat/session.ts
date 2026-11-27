import "server-only";

import Anthropic, { toFile } from "@anthropic-ai/sdk";
import { withAuth } from "@workos-inc/authkit-nextjs";

import { INVOICES_FILE, PURCHASE_ORDERS_FILE } from "./agent-config.ts";
import { getAnthropic, getChatConfig } from "./anthropic.ts";
import { loadChatDataset } from "./dataset.ts";

// A chat is one Managed Agents session: its own sandbox holding a copy of the organization's documents. The session's metadata records who owns it, which is what every chat route checks before touching it.

// Hard cap on what one chat may cost at list prices, in US cents. A chat that
// reaches it pauses for good; the user starts a new one.
const SESSION_BUDGET_CENTS = "500";

const SESSION_ID = /^sesn_[A-Za-z0-9]+$/u;

// The data files are mounted under /mnt/session/uploads (see DATA_DIRECTORY).
const MOUNT_DIRECTORY = "/data";

interface ChatOwner {
  organizationId: string;
  userId: string;
}

const uploadJson = async (name: string, rows: unknown[]) =>
  getAnthropic().beta.files.upload({
    file: await toFile(Buffer.from(JSON.stringify(rows)), name, {
      type: "application/json",
    }),
  });

/**
 * Starts a chat for one user, with a fresh snapshot of their organization's invoices and purchase orders mounted in its sandbox. Returns the session ID.
 */
export const createChatSession = async (
  { organizationId, userId }: ChatOwner,
  config: NonNullable<ReturnType<typeof getChatConfig>>
) => {
  const client = getAnthropic();
  const dataset = await loadChatDataset(organizationId);
  const uploads = await Promise.all([
    uploadJson(INVOICES_FILE, dataset.invoices),
    uploadJson(PURCHASE_ORDERS_FILE, dataset.purchaseOrders),
  ]);

  try {
    const session = await client.beta.sessions.create({
      agent: config.agentId,
      budget: {
        max_list_cost: { amount: SESSION_BUDGET_CENTS, currency: "USD" },
        type: "limit",
      },
      environment_id: config.environmentId,
      metadata: { organization_id: organizationId, user_id: userId },
      resources: uploads.map((file) => ({
        file_id: file.id,
        mount_path: `${MOUNT_DIRECTORY}/${file.filename}`,
        type: "file" as const,
      })),
      title: "Invoice chat",
    });
    return session.id;
  } finally {
    // The session keeps its own copy; don't leave the originals in file storage.
    await Promise.allSettled(
      uploads.map((file) => client.beta.files.delete(file.id))
    );
  }
};

/**
The session, if it exists and belongs to this user in this organization.
*/
const findChatSession = async (
  sessionId: string,
  { organizationId, userId }: ChatOwner
) => {
  if (!SESSION_ID.test(sessionId)) {
    return null;
  }
  const session = await getAnthropic()
    .beta.sessions.retrieve(sessionId)
    .catch((error: unknown) => {
      if (
        error instanceof Anthropic.NotFoundError ||
        error instanceof Anthropic.BadRequestError
      ) {
        return null;
      }
      throw error;
    });
  const isOwner =
    session?.metadata.organization_id === organizationId &&
    session.metadata.user_id === userId;
  return isOwner ? session : null;
};

const refuse = (error: string, status: number) => ({
  ok: false as const,
  response: Response.json({ error }, { status }),
});

/**
 * Gate for the chat routes: a signed-in member of an organization, on a deployment where chat is set up.
 */
export const authorizeChat = async () => {
  const { user, organizationId } = await withAuth();
  if (!user || !organizationId) {
    return refuse("Not signed in", 401);
  }
  const config = getChatConfig();
  if (!config) {
    return refuse("Chat is not set up for this deployment", 503);
  }
  return {
    config,
    ok: true as const,
    owner: { organizationId, userId: user.id },
  };
};

/**
 * Same gate, plus the chat itself. Missing and foreign chats get the same response, so session IDs can't be probed.
 */
export const authorizeChatSession = async (sessionId: string) => {
  const access = await authorizeChat();
  if (!access.ok) {
    return access;
  }
  const session = await findChatSession(sessionId, access.owner);
  return session ? { ...access, session } : refuse("Not found", 404);
};
