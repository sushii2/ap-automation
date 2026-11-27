import { authorizeChat, createChatSession } from "@/lib/chat/session";

// Copies the organization's documents into a new sandbox, which takes a while.
export const maxDuration = 60;

/**
Starts a new chat and returns its ID.
*/
export async function POST() {
  const access = await authorizeChat();
  if (!access.ok) {
    return access.response;
  }
  const sessionId = await createChatSession(access.owner, access.config);
  return Response.json({ sessionId });
}
