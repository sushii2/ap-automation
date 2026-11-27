import { getAnthropic } from "@/lib/chat/anthropic";
import { authorizeChatSession } from "@/lib/chat/session";

/**
 * Stops the assistant mid-answer. The open chat stream sees the turn end and closes on its own.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const access = await authorizeChatSession(sessionId);
  if (!access.ok) {
    return access.response;
  }
  await getAnthropic().beta.sessions.events.send(sessionId, {
    events: [{ type: "user.interrupt" }],
  });
  return new Response(null, { status: 204 });
}
