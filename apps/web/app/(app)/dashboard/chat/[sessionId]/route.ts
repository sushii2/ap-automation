import { z } from "zod";

import { authorizeChatSession } from "@/lib/chat/session";
import { chatStreamResponse } from "@/lib/chat/stream";

// One connection follows a whole turn, and a report can take minutes. If the
// limit cuts a turn short the browser reconnects with GET and carries on.
export const maxDuration = 300;

const messageSchema = z.object({ text: z.string().trim().min(1).max(8000) });

interface RouteContext {
  params: Promise<{ sessionId: string }>;
}

/**
 * Replays the chat so far and, if the assistant is still working, follows it until it stops. Used on page load and to resume a dropped connection.
 */
export async function GET(request: Request, { params }: RouteContext) {
  const { sessionId } = await params;
  const access = await authorizeChatSession(sessionId);
  if (!access.ok) {
    return access.response;
  }
  return chatStreamResponse({
    session: access.session,
    signal: request.signal,
  });
}

/**
Sends a message and streams the chat until the assistant has answered.
*/
export async function POST(request: Request, { params }: RouteContext) {
  const { sessionId } = await params;
  const access = await authorizeChatSession(sessionId);
  if (!access.ok) {
    return access.response;
  }
  const body = messageSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: "Invalid message" }, { status: 400 });
  }
  return chatStreamResponse({
    message: body.data.text,
    session: access.session,
    signal: request.signal,
  });
}
