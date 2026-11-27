import Link from "next/link";
import { Upload } from "lucide-react";

import { Button } from "@workspace/ui/components/ui/cubby-ui/button";

import { PageHeader } from "@/components/page-header";
import { requireOrganization } from "@/lib/auth";
import { listInvoices } from "@/lib/db/document-lists";
import { InvoiceTable } from "./invoice-table";

export const metadata = { title: "Invoice log · AP Automation" };

export default async function InvoicesPage() {
  const { organizationId } = await requireOrganization();
  const invoices = await listInvoices(organizationId);

  return (
    <>
      <PageHeader
        title="Invoice log"
        description="Every invoice, its extraction accuracy, and whether it is indexed and matched to a purchase order."
      >
        <Button
          nativeButton={false}
          render={<Link href="/upload" />}
          leadingIcon={<Upload aria-hidden />}
        >
          Upload invoice
        </Button>
      </PageHeader>
      <InvoiceTable invoices={invoices} />
    </>
  );
}
