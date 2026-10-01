import "server-only";
import { underlying } from "@/lib/fifo";
import { createClient } from "@/lib/supabase/server";

// Lo que te han costado las comisiones (MASTERPLAN §3). Todo ya está dentro
// de la rentabilidad: aquí solo se separa para verlo.
//
// - Compras: Coinbase da el total pagado y el importe que de verdad compró
//   (subtotal). La diferencia es su comisión declarada.
// - Margen en el precio: además, Coinbase compra a un precio algo peor que el
//   de mercado. Se estima comparando con el cierre diario del mismo día, así
//   que es aproximado; se le restan las mejoras de precio que devuelve.
// - Cambios entre monedas: lo que valía lo que diste − lo que valía lo que
//   recibiste en ese momento (comisión + diferencia de precio).
// - Gas: lo que pagaste a la red en la wallet, en todo lo que no sea recibir
//   (al recibir, el gas lo paga quien envía). Zerion no siempre da
//   su valor en euros: entonces se calcula con el precio de ese día.

const FIAT = new Set(["EUR", "USD"]);

type Joined<T> = T | T[] | null;
const one = <T,>(x: Joined<T>) => (Array.isArray(x) ? x[0] : x) as T;

export type Costs = {
  buyFees: number;
  buys: number;
  buyMargin: number | null; // estimación; null si no hay precios
  buyMarginCoverage: number; // parte de lo comprado con precio de mercado
  swapCosts: number;
  swaps: number;
  gas: number;
  total: number;
};

export async function getCosts(): Promise<Costs> {
  const supabase = await createClient();
  const [buysRes, swapsRes, gasRes, adjustRes] = await Promise.all([
    supabase
      .from("transactions")
      .select(
        "amount, occurred_at, buy_id:raw->buy->>id, total:raw->buy->total->>amount, subtotal:raw->buy->subtotal->>amount, currency:raw->buy->total->>currency, assets(symbol)",
      )
      .eq("raw_type", "buy")
      .gt("amount", 0),
    supabase
      .from("transactions")
      .select(
        "amount, value_eur_at_time, tx_hash, trade_id:raw->trade->>id, pair:raw->>pair_tx_hash",
      )
      .eq("type", "swap")
      .eq("is_internal_transfer", false),
    supabase
      .from("transactions")
      .select(
        "tx_hash, occurred_at, fee_value:raw->attributes->fee->>value, fee_qty:raw->attributes->fee->quantity->>float, fee_symbol:raw->attributes->fee->fungible_info->>symbol, operation:raw->attributes->>operation_type, sources!inner(type)",
      )
      .eq("sources.type", "wallet")
      .not("raw->attributes->fee", "is", null),
    supabase.from("transactions").select("value_eur_at_time").eq("type", "ajuste"),
  ]);
  for (const r of [buysRes, swapsRes, gasRes, adjustRes]) if (r.error) throw r.error;

  // 1. Compras: una por pedido (las pagadas con el saldo en euros tienen
  // además una pata en EUR, que se ignora).
  const seen = new Set<string>();
  const buys = (buysRes.data ?? [])
    .map((b) => ({
      symbol: underlying(one(b.assets as Joined<{ symbol: string }>).symbol),
      amount: Number(b.amount),
      date: (b.occurred_at as string).slice(0, 10),
      id: b.buy_id as string | null,
      total: Number(b.total),
      subtotal: Number(b.subtotal),
      currency: b.currency as string | null,
    }))
    .filter((b) => {
      if (FIAT.has(b.symbol) || b.currency !== "EUR" || !b.total || !b.subtotal) return false;
      if (b.id && seen.has(b.id)) return false;
      if (b.id) seen.add(b.id);
      return true;
    });
  const buyFees = buys.reduce((s, b) => s + Math.max(0, b.total - b.subtotal), 0);

  // Gas: una vez por transacción, salvo en lo que recibiste.
  const gasSeen = new Set<string>();
  const gasTxs = (gasRes.data ?? [])
    .filter((g) => {
      const hash = g.tx_hash as string | null;
      if (!hash || gasSeen.has(hash)) return false;
      if (g.operation === "receive") return false;
      gasSeen.add(hash);
      return true;
    })
    .map((g) => ({
      value: g.fee_value != null ? Number(g.fee_value) : null,
      qty: Number(g.fee_qty ?? 0),
      symbol: underlying((g.fee_symbol as string | null) ?? "ETH"),
      date: (g.occurred_at as string).slice(0, 10),
    }));

  // 2. Margen en el precio: subtotal frente a cantidad × cierre de ese día.
  const prices = new Map<string, number>();
  const needPrice = [...buys, ...gasTxs.filter((g) => g.value == null)];
  const symbols = [...new Set(needPrice.map((b) => b.symbol))];
  const dates = [...new Set(needPrice.map((b) => b.date))];
  if (symbols.length && dates.length) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from("price_history")
        .select("symbol, date, price_eur")
        .in("symbol", symbols)
        .in("date", dates)
        .range(from, from + 999);
      if (error) throw error;
      for (const p of data) prices.set(`${p.symbol}|${p.date}`, Number(p.price_eur));
      if (data.length < 1000) break;
    }
  }
  let margin = 0;
  let pricedSubtotal = 0;
  for (const b of buys) {
    const price = prices.get(`${b.symbol}|${b.date}`);
    if (!price) continue;
    margin += b.subtotal - b.amount * price;
    pricedSubtotal += b.subtotal;
  }
  const allSubtotal = buys.reduce((s, b) => s + b.subtotal, 0);
  const rebates = (adjustRes.data ?? []).reduce(
    (s, a) => s + Number(a.value_eur_at_time ?? 0),
    0,
  );

  // 3. Cambios entre monedas, emparejando las dos patas de cada uno.
  const legs = new Map<string, { gave: number; got: number; out: boolean; in: boolean }>();
  for (const t of swapsRes.data ?? []) {
    const key = (t.trade_id as string | null) ?? (t.pair as string | null) ?? t.tx_hash;
    if (!key) continue;
    const l = legs.get(key) ?? { gave: 0, got: 0, out: false, in: false };
    const value = Number(t.value_eur_at_time ?? 0);
    if (Number(t.amount) < 0) {
      l.gave += value;
      l.out = true;
    } else {
      l.got += value;
      l.in = true;
    }
    legs.set(key, l);
  }
  const complete = [...legs.values()].filter((l) => l.out && l.in);
  const swapCosts = complete.reduce((s, l) => s + (l.gave - l.got), 0);

  const gas = gasTxs.reduce(
    (s, g) => s + (g.value ?? g.qty * (prices.get(`${g.symbol}|${g.date}`) ?? 0)),
    0,
  );

  const buyMargin = pricedSubtotal ? margin - rebates : null;
  return {
    buyFees,
    buys: buys.length,
    buyMargin,
    buyMarginCoverage: allSubtotal ? pricedSubtotal / allSubtotal : 0,
    swapCosts,
    swaps: complete.length,
    gas,
    total: buyFees + Math.max(0, buyMargin ?? 0) + swapCosts + gas,
  };
}
