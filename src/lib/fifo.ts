// Motor FIFO (MASTERPLAN §3.7). Función pura: recibe movimientos y saldos
// actuales y devuelve coste, precio de equilibrio y P&L por activo.

export type FifoTx = {
  symbol: string;
  type: string;
  amount: number; // + entra, − sale
  valueEur: number | null; // valor en EUR en el momento de la operación
  occurredAt: string;
  internal: boolean;
};

export type FifoAsset = {
  symbol: string;
  amount: number; // saldo real actual
  valueEur: number;
  priceEur: number | null;
  costEur: number; // coste FIFO de lo que tengo ahora
  breakEvenEur: number | null; // precio al que el activo queda a 0
  unrealizedEur: number;
  realizedEur: number;
  // Cuánto del saldo actual está cubierto por el historial (1 = todo).
  coverage: number;
  unmatchedEur: number; // ventas sin compra registrada (cuentan como beneficio)
  orphanCostEur: number; // coste de lo que el historial dice que tengo y el saldo no
};

// Criterio fiscal (el habitual en España): las recompensas de staking
// entran a su valor de mercado al recibirlas (rendimiento del capital en
// España), que pasa a ser su coste. Las mejoras de precio de Coinbase
// ("ajuste") son un descuento sobre una compra: coste 0.
const ZERO_COST = new Set(["ajuste"]);
// No cambian lo que tengo: moverlo entre mis propias cuentas.
const IGNORED = new Set(["interno"]);
// Dinero en efectivo: no es una inversión ni cuenta para el coste.
export const FIAT = new Set(["EUR", "USD", "GBP", "CHF", "CAD", "AUD"]);

// Versiones "envueltas" del mismo activo: Coinbase envía BTC a Base como
// cbBTC, así que para el coste son el mismo activo.
const ALIAS: Record<string, string> = { cbBTC: "BTC", WBTC: "BTC", WETH: "ETH", ETH2: "ETH" };
export const underlying = (symbol: string) => ALIAS[symbol] ?? symbol;

type Lot = { qty: number; unitCost: number };

// Cada salida (venta, swap, envío) con su coste FIFO: base del informe fiscal.
export type Disposal = {
  symbol: string;
  type: string;
  occurredAt: string;
  amount: number; // unidades que salen (positivo)
  proceedsEur: number; // valor de transmisión
  costEur: number; // valor de adquisición FIFO
  unmatched: boolean; // parte sin compra registrada (coste desconocido)
};

export function computeFifo(
  txs: FifoTx[],
  balances: Map<string, { amount: number; valueEur: number }>,
  disposals?: Disposal[],
): FifoAsset[] {
  const lots = new Map<string, Lot[]>();
  const realized = new Map<string, number>();
  const unmatched = new Map<string, number>();

  const merged = new Map<string, { amount: number; valueEur: number }>();
  for (const [symbol, b] of balances) {
    const m = merged.get(underlying(symbol)) ?? { amount: 0, valueEur: 0 };
    m.amount += b.amount;
    m.valueEur += b.valueEur;
    merged.set(underlying(symbol), m);
  }
  balances = merged;

  const sorted = txs
    .map((t) => ({ ...t, symbol: underlying(t.symbol) }))
    .filter((t) => !t.internal && !IGNORED.has(t.type) && !FIAT.has(t.symbol))
    .sort(
      (a, b) =>
        a.occurredAt.localeCompare(b.occurredAt) ||
        // Misma hora: primero lo que entra (un swap no vende antes de comprar).
        b.amount - a.amount,
    );

  for (const t of sorted) {
    const queue = lots.get(t.symbol) ?? [];
    lots.set(t.symbol, queue);

    if (t.amount > 0) {
      const cost = ZERO_COST.has(t.type) ? 0 : (t.valueEur ?? 0);
      queue.push({ qty: t.amount, unitCost: cost / t.amount });
      continue;
    }

    let toSell = -t.amount;
    let costOut = 0;
    while (toSell > 1e-12 && queue.length) {
      const lot = queue[0];
      const used = Math.min(lot.qty, toSell);
      costOut += used * lot.unitCost;
      lot.qty -= used;
      toSell -= used;
      if (lot.qty <= 1e-12) queue.shift();
    }
    if (toSell > 1e-12) {
      // Vendido sin historial de compra: se sabe lo que se obtuvo, no lo que costó.
      const share = toSell / -t.amount;
      unmatched.set(t.symbol, (unmatched.get(t.symbol) ?? 0) + share * (t.valueEur ?? 0));
    }
    const proceeds = t.valueEur ?? 0;
    realized.set(t.symbol, (realized.get(t.symbol) ?? 0) + proceeds - costOut);
    disposals?.push({
      symbol: t.symbol,
      type: t.type,
      occurredAt: t.occurredAt,
      amount: -t.amount,
      proceedsEur: proceeds,
      costEur: costOut,
      unmatched: toSell > 1e-12,
    });
  }

  const symbols = new Set([...balances.keys(), ...realized.keys(), ...lots.keys()]);
  return [...symbols]
    .filter((s) => !FIAT.has(s))
    .map((symbol) => {
      const bal = balances.get(symbol) ?? { amount: 0, valueEur: 0 };
      const queue = lots.get(symbol) ?? [];
      const lotQty = queue.reduce((s, l) => s + l.qty, 0);
      const lotCost = queue.reduce((s, l) => s + l.qty * l.unitCost, 0);

      // El historial puede no cuadrar con el saldo (comisiones, salidas que no
      // registra la API). Si sobra historial, ese coste se da por perdido
      // (pérdida realizada); si falta, esas unidades cuentan a coste 0 y se avisa.
      const costEur =
        lotQty > bal.amount && lotQty > 0 ? lotCost * (bal.amount / lotQty) : lotCost;
      const coverage = bal.amount > 0 ? Math.min(1, lotQty / bal.amount) : 1;
      const orphanCostEur = lotQty > bal.amount ? lotCost - costEur : 0;

      return {
        symbol,
        amount: bal.amount,
        valueEur: bal.valueEur,
        priceEur: bal.amount > 0 ? bal.valueEur / bal.amount : null,
        costEur,
        breakEvenEur: bal.amount > 0 ? costEur / bal.amount : null,
        unrealizedEur: bal.valueEur - costEur,
        realizedEur: (realized.get(symbol) ?? 0) - orphanCostEur,
        coverage,
        unmatchedEur: unmatched.get(symbol) ?? 0,
        orphanCostEur,
      };
    });
}
