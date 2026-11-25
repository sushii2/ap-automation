import "server-only"

import { put } from "@vercel/blob"

export type DocumentKind = "invoice" | "purchase_order"

/** Keeps a file name readable while making it safe to use as a path segment. */
export function safeFileName(name: string) {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^[._]+/, "")
    .slice(-120)
  return cleaned || "document"
}

/** Where an uploaded document lives: one folder per organization and kind. */
export function documentPathname(
  organizationId: string,
  kind: DocumentKind,
  fileName: string,
  id: string = crypto.randomUUID()
) {
  return `org/${organizationId}/${kind}/${id}/${safeFileName(fileName)}`
}

/**
 * Saves the original document to the private Vercel Blob store and returns its
 * pathname. Blobs are private: read them back with `get(pathname, { access: "private" })`.
 *
 * Returns null in local development when no store is configured, so the upload
 * flow still works without Blob credentials. Deployed environments always store.
 */
export async function storeDocument(
  organizationId: string,
  kind: DocumentKind,
  file: File
) {
  if (
    !process.env.BLOB_READ_WRITE_TOKEN &&
    process.env.NODE_ENV !== "production"
  ) {
    console.warn(
      `BLOB_READ_WRITE_TOKEN is not set; ${file.name} was not saved to Blob storage.`
    )
    return null
  }

  const blob = await put(
    documentPathname(organizationId, kind, file.name),
    file,
    {
      access: "private",
      contentType: file.type || undefined,
    }
  )
  return blob.pathname
}
