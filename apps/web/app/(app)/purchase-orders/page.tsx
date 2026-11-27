import { Suspense } from "react";

import { requireOrganization } from "@/lib/auth";
import { listPurchaseOrders } from "@/lib/db/document-lists";
import { PurchaseOrders } from "./purchase-orders";

export const metadata = { title: "Purchase orders · AP Automation" };

export default async function PurchaseOrdersPage() {
  const { organizationId } = await requireOrganization();
  const orders = await listPurchaseOrders(organizationId);

  return (
    // PurchaseOrders reads the `?new=` search param to open its drawers.
    <Suspense>
      <PurchaseOrders saved={orders} />
    </Suspense>
  );
}
