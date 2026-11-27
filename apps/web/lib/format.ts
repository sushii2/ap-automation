const DEFAULT_CURRENCY = "USD";

const currencyFormats = new Map<string, Intl.NumberFormat>();

const date = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const currencyFormat = (code: string) => {
  const cached = currencyFormats.get(code);
  if (cached) {
    return cached;
  }
  const format = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: code,
  });
  currencyFormats.set(code, format);
  return format;
};

/**
The formatter for a currency code. A missing or unrecognized code (extracted documents can carry anything) falls back to US dollars.
*/
const resolveCurrencyFormat = (code?: string | null) => {
  const normalized = code?.trim().toUpperCase() || DEFAULT_CURRENCY;
  try {
    return currencyFormat(normalized);
  } catch {
    return currencyFormat(DEFAULT_CURRENCY);
  }
};

export const formatCurrency = (amount: number, code?: string | null) =>
  resolveCurrencyFormat(code).format(amount);

/**
Formats an ISO `YYYY-MM-DD` date without shifting it across time zones.
*/
export const formatDate = (isoDate: string) => date.format(new Date(isoDate));
