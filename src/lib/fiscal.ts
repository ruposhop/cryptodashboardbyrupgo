import "server-only";
import { computeFifo, type Disposal } from "@/lib/fifo";
import { allTransactions } from "@/lib/portfolio";
import { createClient } from "@/lib/supabase/server";

// Informe fiscal (MASTERPLAN §4): ganancias y pérdidas por FIFO de cada año.
// Es informativo: el criterio final lo valida un asesor.

// Transmisiones que generan ganancia o pérdida: ventas y permutas (swaps).
// Los envíos a terceros no se incluyen: pueden ir a otra cartera tuya.
const TAXABLE = new Set(["venta", "swap"]);

export type FiscalYear = {
  year: number;
  disposals: Disposal[];
  gains: number;
  losses: number;
  net: number;
  rewardsEur: number; // recompensas de staking recibidas (valor de mercado)
  rewardsCount: number;
  excludedSends: number; // envíos a terceros, fuera del cálculo
  hasUnmatched: boolean;
};

type Joined<T> = T | T[] | null;
const one = <T,>(x: Joined<T>) => (Array.isArray(x) ? x[0] : x) as T;

export async function getFiscalYears(): Promise<FiscalYear[]> {
  const supabase = await createClient();
  const txs = (await allTransactions(supabase)).map((t) => ({
    symbol: one(t.assets as Joined<{ symbol: string }>).symbol,
    type: t.type,
    amount: Number(t.amount),
    valueEur: t.value_eur_at_time != null ? Number(t.value_eur_at_time) : null,
    occurredAt: t.occurred_at,
    internal: t.is_internal_transfer,
  }));

  const disposals: Disposal[] = [];
  computeFifo(txs, new Map(), disposals);

  const years = new Map<number, FiscalYear>();
  const yearOf = (iso: string) => Number(iso.slice(0, 4));
  const get = (year: number) => {
    if (!years.has(year)) {
      years.set(year, {
        year,
        disposals: [],
        gains: 0,
        losses: 0,
        net: 0,
        rewardsEur: 0,
        rewardsCount: 0,
        excludedSends: 0,
        hasUnmatched: false,
      });
    }
    return years.get(year)!;
  };

  for (const d of disposals) {
    const y = get(yearOf(d.occurredAt));
    if (!TAXABLE.has(d.type)) {
      y.excludedSends++;
      continue;
    }
    y.disposals.push(d);
    const result = d.proceedsEur - d.costEur;
    if (result >= 0) y.gains += result;
    else y.losses += result;
    y.net += result;
    if (d.unmatched) y.hasUnmatched = true;
  }
  for (const t of txs) {
    if (t.type !== "recompensa" || t.internal) continue;
    const y = get(yearOf(t.occurredAt));
    y.rewardsEur += t.valueEur ?? 0;
    y.rewardsCount++;
  }

  return [...years.values()]
    .map((y) => ({
      ...y,
      disposals: y.disposals.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)),
    }))
    .sort((a, b) => b.year - a.year);
}

// Resumen por activo: lo que se suele trasladar a la declaración.
export function bySymbol(disposals: Disposal[]) {
  const map = new Map<string, { symbol: string; proceeds: number; cost: number; count: number }>();
  for (const d of disposals) {
    const s = map.get(d.symbol) ?? { symbol: d.symbol, proceeds: 0, cost: 0, count: 0 };
    s.proceeds += d.proceedsEur;
    s.cost += d.costEur;
    s.count++;
    map.set(d.symbol, s);
  }
  return [...map.values()].sort(
    (a, b) => Math.abs(b.proceeds - b.cost) - Math.abs(a.proceeds - a.cost),
  );
}
