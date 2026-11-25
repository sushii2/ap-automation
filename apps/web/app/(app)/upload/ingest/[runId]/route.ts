import { runs } from "@trigger.dev/sdk"
import { withAuth } from "@workos-inc/authkit-nextjs"

import type { ingestInvoice } from "@/src/trigger/ingest-invoice"
import type { ingestPurchaseOrder } from "@/src/trigger/ingest-purchase-order"

/** Status and result of one ingestion run, polled by the upload page. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { user, organizationId } = await withAuth()
  if (!user || !organizationId) {
    return Response.json({ error: "Not signed in" }, { status: 401 })
  }

  const { runId } = await params
  const run = await runs
    .retrieve<typeof ingestInvoice | typeof ingestPurchaseOrder>(runId)
    .catch(() => null)
  // Same response for missing and foreign runs, so run IDs can't be probed.
  if (!run || !run.tags.includes(`org:${organizationId}`)) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  return Response.json({
    status: run.status,
    stage: run.metadata?.stage ?? null,
    done: run.isCompleted,
    output: run.isSuccess ? (run.output ?? null) : null,
    error: run.isFailed ? (run.error?.message ?? "Run failed") : null,
  })
}
