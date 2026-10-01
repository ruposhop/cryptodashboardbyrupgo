import "server-only";
import { currentPrices } from "@/lib/alerts";
import { underlying } from "@/lib/fifo";
import { getPortfolio } from "@/lib/portfolio";
import { createClient } from "@/lib/supabase/server";

// Visión de "fondo personal": el dueño no pasa a euros, solo acumula y rota
// entre monedas. Aquí se mide la rentabilidad del dinero metido y si los
// cambios entre monedas han sumado o restado.

const FIAT = new Set(["EUR", "USD"]);
const DAY = 86400000;

type Row = {
  id: string;
  occurred_at: string;
  type: string;
  amount: number;
  value_eur_at_time: number | null;
  is_internal_transfer: boolean;
  tx_hash: string | null;
  trade_id: string | null;
  pair: string | null;
  assets: { symbol: string } | { symbol: string }[];
  sources: { type: string } | { type: string }[];
};

const one = <T,>(x: T | T[]) => (Array.isArray(x) ? x[0] : x);

async function loadRows() {
  const supabase = await createClient();
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("transactions")
      .select(
        "id, occurred_at, type, amount, value_eur_at_time, is_internal_transfer, tx_hash, trade_id:raw->trade->>id, pair:raw->>pair_tx_hash, assets(symbol), sources(type)",
      )
      .order("occurred_at")
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...(data as unknown as Row[]));
    if (data.length < 1000) return rows;
  }
}

export type Swap = {
  key: string;
  occurredAt: string;
  origin: string;
  gave: { symbol: string; amount: number; valueThen: number; valueToday: number | null };
  got: { symbol: string; amount: number; valueThen: number; valueToday: number | null };
  costThen: number; // lo que se fue en comisión y diferencia de precio
  verdict: number | null; // hoy: lo recibido − lo que habrías tenido sin cambiar
};

export async function getStrategy() {
  const [rows, portfolio, rates] = await Promise.all([
    loadRows(),
    getPortfolio(),
    currentPrices().catch(() => new Map<string, number>()),
  ]);

  // Precio de hoy por moneda: el de tu saldo, el público de Coinbase o, si no
  // cotiza allí (p. ej. un token de la wallet ya vendido), el último precio de tus movimientos.
  const lastSeen = new Map<string, number>();
  for (const r of rows) {
    const v = Number(r.value_eur_at_time ?? 0);
    const a = Number(r.amount);
    if (v && a) lastSeen.set(underlying(one(r.assets).symbol), Math.abs(v / a));
  }
  const priceOf = (raw: string) => {
    const s = underlying(raw);
    return (
      portfolio.assets.find((a) => a.symbol === s && a.priceEur)?.priceEur ??
      rates.get(s) ??
      lastSeen.get(s) ??
      null
    );
  };

  const valid = rows.filter(
    (r) => !r.is_internal_transfer && r.type !== "interno" && !FIAT.has(one(r.assets).symbol),
  );

  const now = Date.now();
  const firstAt = valid.find((r) => r.type === "compra")?.occurred_at ?? null;

  // 2. Cada cambio entre monedas, con qué diste y qué recibiste.
  const groups = new Map<string, Row[]>();
  for (const r of valid.filter((r) => r.type === "swap")) {
    const key = r.trade_id ?? r.pair ?? r.tx_hash ?? r.id;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const swaps: Swap[] = [];
  for (const [key, legs] of groups) {
    const out = legs.find((l) => Number(l.amount) < 0);
    const inn = legs.find((l) => Number(l.amount) > 0);
    if (!out || !inn) continue;
    const leg = (l: Row) => {
      const symbol = one(l.assets).symbol;
      const amount = Math.abs(Number(l.amount));
      const price = priceOf(symbol);
      return {
        symbol,
        amount,
        valueThen: Number(l.value_eur_at_time ?? 0),
        valueToday: price != null ? amount * price : null,
      };
    };
    const gave = leg(out);
    const got = leg(inn);
    swaps.push({
      key,
      occurredAt: [out.occurred_at, inn.occurred_at].sort()[0],
      origin: one(out.sources).type === "coinbase" ? "Coinbase" : "Wallet",
      gave,
      got,
      costThen: gave.valueThen - got.valueThen,
      verdict:
        gave.valueToday != null && got.valueToday != null
          ? got.valueToday - gave.valueToday
          : null,
    });
  }
  swaps.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  // 3. ¿Y si nunca hubieras cambiado nada? Mismas compras, recompensas y
  // envíos, pero sin ningún swap: lo que tendrías hoy.
  const held = new Map<string, number>();
  for (const r of valid.filter((r) => r.type !== "swap")) {
    const s = underlying(one(r.assets).symbol);
    held.set(s, (held.get(s) ?? 0) + Number(r.amount));
  }
  let holdOnlyValue = 0;
  const holdOnly: { symbol: string; amount: number; valueEur: number }[] = [];
  for (const [symbol, amount] of held) {
    if (amount <= 1e-9) continue;
    const price = priceOf(symbol);
    if (price == null) continue;
    holdOnlyValue += amount * price;
    holdOnly.push({ symbol, amount, valueEur: amount * price });
  }
  holdOnly.sort((a, b) => b.valueEur - a.valueEur);

  return {
    total: portfolio.total,
    contributed: portfolio.contributed,
    profit: portfolio.pnl,
    irr: portfolio.irr,
    firstAt,
    years: firstAt ? (now - Date.parse(firstAt)) / (365 * DAY) : 0,
    swaps,
    swapCosts: swaps.reduce((s, w) => s + w.costThen, 0),
    holdOnlyValue,
    holdOnly,
    swapsEffect: portfolio.total - holdOnlyValue,
  };
}
