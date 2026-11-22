import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/ui/cubby-ui/card"

import { PageHeader } from "@/components/page-header"

export const metadata = { title: "Analytics · AP Automation" }

// Placeholder widgets; metrics get wired up later.
const METRICS = [
  "Invoices processed",
  "Average extraction accuracy",
  "PO match rate",
  "Awaiting review",
]

export default function AnalyticsPage() {
  return (
    <>
      <PageHeader
        title="Analytics"
        description="Metrics for invoice processing and purchase-order matching."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {METRICS.map((metric) => (
          <Card key={metric}>
            <CardHeader>
              <CardDescription>{metric}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">—</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              No data yet
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}
