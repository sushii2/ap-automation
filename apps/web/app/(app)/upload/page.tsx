import { DocumentUpload } from "@/components/document-upload"
import { PageHeader } from "@/components/page-header"

export const metadata = { title: "Upload · AP Automation" }

export default function UploadPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Upload invoices"
        description="Add invoices to extract their details and match them to purchase orders."
      />
      <DocumentUpload title="Drop invoices here or click to browse" />
    </div>
  )
}
