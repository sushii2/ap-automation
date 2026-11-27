import { getAnthropic } from "@/lib/chat/anthropic";
import { authorizeChatSession } from "@/lib/chat/session";
import { listOutputFiles } from "@/lib/chat/stream";

const UNSAFE_FILE_NAME_CHARACTERS = /[^\w.\- ]/gu;

/**
 * Downloads a file the assistant produced in this chat, e.g. a PDF report.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string; fileId: string }> }
) {
  const { sessionId, fileId } = await params;
  const access = await authorizeChatSession(sessionId);
  if (!access.ok) {
    return access.response;
  }

  // Only files this chat produced: a file ID from anywhere else is not found.
  const files = await listOutputFiles(access.session);
  const file = files.find((candidate) => candidate.id === fileId);
  if (!file) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const download = await getAnthropic().beta.files.download(file.id);
  const name = file.filename.replaceAll(UNSAFE_FILE_NAME_CHARACTERS, "_");
  return new Response(download.body, {
    headers: {
      "Cache-Control": "private, no-store",
      // Always a download: the assistant's output is never rendered on our origin.
      "Content-Disposition": `attachment; filename="${name}"`,
      "Content-Length": String(file.size_bytes),
      "Content-Type": "application/octet-stream",
    },
  });
}
