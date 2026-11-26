import { tasks } from "@trigger.dev/sdk";
import { withAuth } from "@workos-inc/authkit-nextjs";
import Reducto from "reductoai";

import { syncMembership } from "@/lib/directory";
import { storeDocument } from "@/lib/document-storage";
import type { DocumentKind } from "@/lib/document-storage";
import "@/lib/trigger";
import type { ingestInvoice } from "@/src/trigger/ingest-invoice";
import type { ingestPurchaseOrder } from "@/src/trigger/ingest-purchase-order";

const MAX_SIZE = 25 * 1024 * 1024;
const EXTENSIONS = new Set(["pdf", "docx"]);

// The document kind the uploader declares, mapped to the task that ingests it.
const TASKS = {
  invoice: "ingest-invoice",
  purchase_order: "ingest-purchase-order",
} as const;

/**
 * Receives one document, saves the original to Blob storage, hands a copy to Reducto for parsing and starts the ingestion run.
 */
export async function POST(request: Request) {
  const { user, organizationId, role } = await withAuth();
  if (!user || !organizationId) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }

  const form = await request.formData();
  const kind = form.get("kind");
  if (typeof kind !== "string" || !Object.hasOwn(TASKS, kind)) {
    return Response.json({ error: "Unknown document kind" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!EXTENSIONS.has(extension)) {
    return Response.json({ error: "Only PDF or DOCX" }, { status: 415 });
  }
  if (file.size === 0 || file.size > MAX_SIZE) {
    return Response.json(
      { error: "File is empty or too large" },
      { status: 413 }
    );
  }

  // The stored document references its organization and uploader.
  await syncMembership({ organizationId, role, user });

  // Keep the original before anything else touches it: Reducto's copy is temporary.
  const blobPathname = await storeDocument(
    organizationId,
    kind as DocumentKind,
    file
  );

  const upload = await new Reducto().upload({ file, extension });

  const handle = await tasks.trigger<
    typeof ingestInvoice | typeof ingestPurchaseOrder
  >(
    TASKS[kind as keyof typeof TASKS],
    {
      organizationId,
      fileName: file.name,
      reductoFileId: upload.file_id,
      uploadedBy: user.id,
      ...(blobPathname && { blobPathname }),
    },
    // Tagged so only members of this organization can read the run.
    { tags: [`org:${organizationId}`] }
  );

  return Response.json({ runId: handle.id });
}
