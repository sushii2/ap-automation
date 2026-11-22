import { Suspense } from "react"

import { PLACEHOLDER_PURCHASE_ORDERS } from "@/lib/placeholder-data"

import { PurchaseOrders } from "./purchase-orders"

export const metadata = { title: "Purchase orders · AP Automation" }

export default function PurchaseOrdersPage() {
  return (
    // PurchaseOrders reads the `?new=` search param to open its drawers.
    <Suspense>
      <PurchaseOrders initial={PLACEHOLDER_PURCHASE_ORDERS} />
    </Suspense>
  )
}
