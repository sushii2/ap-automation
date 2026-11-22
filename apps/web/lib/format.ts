const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

const date = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
})

export const formatCurrency = (amount: number) => currency.format(amount)

/** Formats an ISO `YYYY-MM-DD` date without shifting it across time zones. */
export const formatDate = (isoDate: string) => date.format(new Date(isoDate))
