import Link from "next/link";
import { Upload } from "lucide-react";

import { Button } from "@workspace/ui/components/ui/cubby-ui/button";

import { InvoiceChat } from "./invoice-chat";
import { PageHeader } from "@/components/page-header";
import { requireOrganization } from "@/lib/auth";
import { getChatConfig } from "@/lib/chat/anthropic";

export const metadata = { title: "Dashboard · AP Automation" };

export default async function DashboardPage() {
  const { user, organizationId } = await requireOrganization();

  return (
    // Fills the viewport (minus the layout's padding) so the chat input stays
    // pinned to the bottom while the thread scrolls.
    <div className="mx-auto flex h-[calc(100svh-3rem)] max-w-3xl flex-col md:h-[calc(100svh-4rem)]">
      <PageHeader
        title={`Welcome back${user.firstName ? `, ${user.firstName}` : ""}`}
        description="Ask about your invoices and purchase orders, get an analysis or a report, or upload a new document."
      >
        <Button
          nativeButton={false}
          render={<Link href="/upload" />}
          leadingIcon={<Upload aria-hidden />}
        >
          Upload invoice
        </Button>
      </PageHeader>
      <InvoiceChat
        // One remembered chat per user and organization on this browser.
        storageKey={`invoice-chat:${organizationId}:${user.id}`}
        isEnabled={getChatConfig() !== null}
      />
    </div>
  );
}
