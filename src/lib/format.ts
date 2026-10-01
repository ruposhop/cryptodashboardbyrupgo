// Moneda de la instalación (EUR, USD…): la decide src/lib/currency.ts en el
// servidor. Los componentes de cliente la reciben como prop y llaman a
// setCurrency antes de formatear. Un dueño por instalación: es siempre la misma.
let currency = "EUR";
const cache = new Map<string, Intl.NumberFormat>();

export function setCurrency(code: string) {
  currency = code.toUpperCase();
}
export const getDisplayCurrency = () => currency;

function money(options: Intl.NumberFormatOptions = {}) {
  const key = `${currency}|${JSON.stringify(options)}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      ...options,
    });
    cache.set(key, f);
  }
  return f;
}

const pct = new Intl.NumberFormat("es-ES", {
  style: "percent",
  maximumFractionDigits: 2,
  signDisplay: "exceptZero",
});
const pctPlain = new Intl.NumberFormat("es-ES", {
  style: "percent",
  maximumFractionDigits: 1,
});

export const formatMoney = (n: number) => money().format(n);
export const formatMoneySigned = (n: number) =>
  money({ signDisplay: "exceptZero" }).format(n);
export const formatPct = (n: number) => pct.format(n);
export const formatWeight = (n: number) => pctPlain.format(n);

// Precios de tokens baratos necesitan más decimales (0,0812 €, 0,000009 €).
export function formatPrice(n: number) {
  const digits = n >= 100 ? 2 : n >= 1 ? 3 : n >= 0.01 ? 4 : 8;
  return money({
    minimumFractionDigits: Math.min(digits, 2),
    maximumFractionDigits: digits,
  }).format(n);
}

// "€", "$"…, para etiquetas como "Precio (€)".
export const currencySymbol = () =>
  money().formatToParts(0).find((p) => p.type === "currency")?.value ?? currency;

// "euros", "dólares"… para los textos ("compras con euros").
const NAMES: Record<string, string> = {
  EUR: "euros",
  USD: "dólares",
  GBP: "libras",
  CHF: "francos",
  CAD: "dólares",
  AUD: "dólares",
};
export const currencyName = () => NAMES[currency] ?? currency;

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
