const eur = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
});
const eurSigned = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  signDisplay: "exceptZero",
});
const pct = new Intl.NumberFormat("es-ES", {
  style: "percent",
  maximumFractionDigits: 2,
  signDisplay: "exceptZero",
});
const pctPlain = new Intl.NumberFormat("es-ES", {
  style: "percent",
  maximumFractionDigits: 1,
});

export const formatEur = (n: number) => eur.format(n);
export const formatEurSigned = (n: number) => eurSigned.format(n);
export const formatPct = (n: number) => pct.format(n);
export const formatWeight = (n: number) => pctPlain.format(n);

// Precios de tokens baratos necesitan más decimales (0,0812 €, 0,000009 €).
export function formatPrice(n: number) {
  const digits = n >= 100 ? 2 : n >= 1 ? 3 : n >= 0.01 ? 4 : 8;
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: Math.min(digits, 2),
    maximumFractionDigits: digits,
  }).format(n);
}

export function formatAmount(n: number) {
  const digits = Math.abs(n) >= 1000 ? 2 : Math.abs(n) >= 1 ? 4 : 8;
  return new Intl.NumberFormat("es-ES", {
    maximumFractionDigits: digits,
  }).format(n);
}

export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Madrid",
  }).format(new Date(iso));

// Verde y rojo solo para P&L (CLAUDE.md).
export const pnlClass = (n: number) =>
  n > 0 ? "text-gain" : n < 0 ? "text-loss" : "";
