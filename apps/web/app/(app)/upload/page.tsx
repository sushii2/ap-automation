import { z } from "zod";

import { DocumentUpload } from "@/components/document-upload";
import { PageHeader } from "@/components/page-header";
import { invoiceSchema } from "@/lib/invoice-schema";

export const metadata = { title: "Upload · AP Automation" };

const EXTRACTION_SCHEMA = JSON.stringify(
  z.toJSONSchema(invoiceSchema),
  null,
  2
);

export default function UploadPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Upload invoices"
        description="Add invoices to extract their details and match them to purchase orders."
      />
      <DocumentUpload
        kind="invoice"
        title="Drop invoices here or click to browse"
      />
      <details className="mt-6">
        <summary className="cursor-pointer text-sm font-medium">
          Extraction schema
        </summary>
        <pre className="mt-2 max-h-[32rem] overflow-auto rounded-lg border bg-muted/40 p-4 font-mono text-xs">
          {EXTRACTION_SCHEMA}
        </pre>
      </details>
    </div>
  );
}
