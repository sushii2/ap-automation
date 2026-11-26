import Link from "next/link";
import { Upload } from "lucide-react";

import { Button } from "@workspace/ui/components/ui/cubby-ui/button";

import { InvoiceTable } from "./invoice-table";
import { PageHeader } from "@/components/page-header";
import { PLACEHOLDER_INVOICES } from "@/lib/placeholder-data";

export const metadata = { title: "Invoice log · AP Automation" };

export default function InvoicesPage() {
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
      <InvoiceTable invoices={PLACEHOLDER_INVOICES} />
    </>
  );
}
