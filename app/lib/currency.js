// Currency formatting utilities

const CURRENCIES = {
  USD: { symbol: "$", name: "US Dollar" },
  EUR: { symbol: "€", name: "Euro" },
  GBP: { symbol: "£", name: "British Pound" },
  JPY: { symbol: "¥", name: "Japanese Yen" },
  CAD: { symbol: "$", name: "Canadian Dollar" },
  AUD: { symbol: "A$", name: "Australian Dollar" },
  CHF: { symbol: "CHF", name: "Swiss Franc" },
  CNY: { symbol: "¥", name: "Chinese Yuan" },
  INR: { symbol: "₹", name: "Indian Rupee" },
  MXN: { symbol: "$", name: "Mexican Peso" },
  BRL: { symbol: "R$", name: "Brazilian Real" },
  ZAR: { symbol: "R", name: "South African Rand" },
};

export const getCurrencySymbol = (currency = "USD") => {
  return CURRENCIES[currency]?.symbol || "$";
};

export const getCurrencyName = (currency = "USD") => {
  return CURRENCIES[currency]?.name || "US Dollar";
};

export const formatCurrency = (amount, currency = "USD") => {
  const symbol = getCurrencySymbol(currency);
  const absAmount = Math.abs(amount);

  // Use Intl for proper locale formatting
  const formatted = absAmount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `${symbol}${formatted}`;
};

export const formatCurrencyShort = (amount, currency = "USD") => {
  const symbol = getCurrencySymbol(currency);
  const absAmount = Math.abs(amount);

  if (absAmount >= 1000000) {
    return `${symbol}${(absAmount / 1000000).toFixed(1)}M`;
  }
  if (absAmount >= 1000) {
    return `${symbol}${(absAmount / 1000).toFixed(1)}k`;
  }
  return `${symbol}${absAmount.toFixed(0)}`;
};

export const AVAILABLE_CURRENCIES = Object.keys(CURRENCIES).map((code) => ({
  code,
  name: CURRENCIES[code].name,
  symbol: CURRENCIES[code].symbol,
}));
