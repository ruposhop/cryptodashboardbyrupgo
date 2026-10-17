// Cálculos del "fondo personal" como funciones puras (sin base de datos), para
// poder probarlos con `npm test`. Las usan portfolio.ts y costs.ts.

export type FundTx = {
  type: string;
  amount: number; // + entra, − sale
  value: number | null; // en la moneda de la instalación
  occurredAt: string;
  internal: boolean; // entre tus propias cuentas
  fiat: boolean; // el propio dinero (EUR, USD…), no una inversión
};

// Dinero metido neto = compras + entradas de fuera − ventas − salidas fuera,
// con su desglose y los flujos fechados para la TIR (negativo = entra al fondo).
export function computeContributions(txs: FundTx[]) {
  const parts = {
    compras: { count: 0, eur: 0 },
    entradas: { count: 0, eur: 0 },
    ventas: { count: 0, eur: 0 },
    salidas: { count: 0, eur: 0 },
  };
  const partOf: Record<string, keyof typeof parts> = {
    compra: "compras",
    recepcion: "entradas",
    venta: "ventas",
    envio: "salidas",
  };
  let contributed = 0;
  const cashFlows: { t: number; v: number }[] = [];
  for (const t of txs) {
    if (t.internal || t.type === "interno" || t.fiat) continue;
    const value = t.value ?? 0;
    let cash = 0;
    if ((t.type === "compra" || t.type === "recepcion") && t.amount > 0) cash = -value;
    if ((t.type === "venta" || t.type === "envio") && t.amount < 0) cash = value;
    if (!cash) continue;
    contributed -= cash;
    parts[partOf[t.type]].count++;
    parts[partOf[t.type]].eur += Math.abs(cash);
    cashFlows.push({ t: Date.parse(t.occurredAt), v: cash });
  }
  return { contributed, parts, cashFlows };
}

export type BuyRow = {
  id: string | null; // pedido de Coinbase (las dos patas comparten id)
  symbol: string;
  fiat: boolean;
  amount: number;
  date: string; // AAAA-MM-DD
  total: number; // lo que pagaste
  subtotal: number; // lo que de verdad se compró
  currency: string | null;
};

// Una compra por pedido, solo en tu moneda: la pata en efectivo se ignora.
export function uniqueBuys(rows: BuyRow[], currency: string) {
  const seen = new Set<string>();
  return rows.filter((b) => {
    if (b.fiat || b.currency !== currency || !b.total || !b.subtotal) return false;
    if (b.id && seen.has(b.id)) return false;
    if (b.id) seen.add(b.id);
    return true;
  });
}

// Comisión declarada: total pagado − importe comprado.
export const buyFees = (buys: BuyRow[]) =>
  buys.reduce((s, b) => s + Math.max(0, b.total - b.subtotal), 0);

// Margen en el precio: subtotal frente a cantidad × precio de mercado ese día.
export function buyMargin(buys: BuyRow[], priceOn: (symbol: string, date: string) => number | undefined) {
  let margin = 0;
  let priced = 0;
  for (const b of buys) {
    const price = priceOn(b.symbol, b.date);
    if (!price) continue;
    margin += b.subtotal - b.amount * price;
    priced += b.subtotal;
  }
  const all = buys.reduce((s, b) => s + b.subtotal, 0);
  return { margin, coverage: all ? priced / all : 0, priced };
}

export type SwapLeg = { key: string | null; amount: number; value: number | null };

// Coste de los cambios: lo que valía lo que diste − lo que valía lo que
// recibiste, solo en cambios con sus dos patas.
export function swapCosts(legs: SwapLeg[]) {
  const pairs = new Map<string, { gave: number; got: number; out: boolean; in: boolean }>();
  for (const l of legs) {
    if (!l.key) continue;
    const p = pairs.get(l.key) ?? { gave: 0, got: 0, out: false, in: false };
    if (l.amount < 0) {
      p.gave += l.value ?? 0;
      p.out = true;
    } else {
      p.got += l.value ?? 0;
      p.in = true;
    }
    pairs.set(l.key, p);
  }
  const complete = [...pairs.values()].filter((p) => p.out && p.in);
  return { cost: complete.reduce((s, p) => s + (p.gave - p.got), 0), count: complete.length };
}
