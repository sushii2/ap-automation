import { tasks } from "@trigger.dev/sdk"
import { withAuth } from "@workos-inc/authkit-nextjs"
import Reducto from "reductoai"

import type { ingestInvoice } from "@/src/trigger/ingest-invoice"

const MAX_SIZE = 25 * 1024 * 1024
const EXTENSIONS = new Set(["pdf", "docx"])

/**
 * Receives one document, stores it with Reducto and starts the ingestion run.
 * There is no object storage yet, so Reducto's upload store holds the file.
 */
export async function POST(request: Request) {
  const { user, organizationId } = await withAuth()
  if (!user || !organizationId) {
    return Response.json({ error: "Not signed in" }, { status: 401 })
  }

  const file = (await request.formData()).get("file")
  if (!(file instanceof File)) {
    return Response.json({ error: "No file provided" }, { status: 400 })
  }
  const extension = file.name.split(".").pop()?.toLowerCase() ?? ""
  if (!EXTENSIONS.has(extension)) {
    return Response.json({ error: "Only PDF or DOCX" }, { status: 415 })
  }
  if (file.size === 0 || file.size > MAX_SIZE) {
    return Response.json(
      { error: "File is empty or too large" },
      { status: 413 }
    )
  }

  const upload = await new Reducto().upload({ file, extension })

  const handle = await tasks.trigger<typeof ingestInvoice>(
    "ingest-invoice",
    { fileName: file.name, reductoFileId: upload.file_id },
    // Tagged so only members of this organization can read the run.
    { tags: [`org:${organizationId}`] }
  )

  return Response.json({ runId: handle.id })
}
