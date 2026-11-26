import Link from "next/link";
import { Upload } from "lucide-react";

import { Button } from "@workspace/ui/components/ui/cubby-ui/button";

import { InvoiceChat } from "./invoice-chat";
import { PageHeader } from "@/components/page-header";
import { requireOrganization } from "@/lib/auth";

export const metadata = { title: "Dashboard · AP Automation" };

export default async function DashboardPage() {
  const { user } = await requireOrganization();

  return (
    // Fills the viewport (minus the layout's padding) so the chat input stays
    // pinned to the bottom while the thread scrolls.
    <div className="mx-auto flex h-[calc(100svh-3rem)] max-w-3xl flex-col md:h-[calc(100svh-4rem)]">
      <PageHeader
        title={`Welcome back${user.firstName ? `, ${user.firstName}` : ""}`}
        description="Ask a question about your invoices, or upload a new one."
      >
        <Button
          nativeButton={false}
          render={<Link href="/upload" />}
          leadingIcon={<Upload aria-hidden />}
        >
          Upload invoice
        </Button>
      </PageHeader>
      <InvoiceChat />
    </div>
  );
}
