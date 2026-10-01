import "server-only";
import { FIAT, getCurrency, STABLE } from "@/lib/currency";
import { underlying } from "@/lib/fifo";
import { createAdminClient } from "@/lib/supabase/admin";

// Reconstruye el valor diario de la cartera hacia atrás (MASTERPLAN §3.4):
// cantidades a partir de los movimientos y precios de cierre diarios de la
// API pública de Coinbase Exchange (sin clave, sin cupo mensual), en la moneda
// de la instalación (las columnas *_eur guardan esa moneda).

const EXCHANGE = "https://api.exchange.coinbase.com";
const DAY = 24 * 3600 * 1000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);

type Db = ReturnType<typeof createAdminClient>;

let products: Set<string> | null = null;
async function listProducts() {
  if (!products) {
    const res = await fetch(`${EXCHANGE}/products`, {
      headers: { "User-Agent": "crypto-dashboard" },
    });
    products = new Set(((await res.json()) as { id: string }[]).map((p) => p.id));
  }
  return products;
}

// Cierres diarios de un par entre dos fechas (la API da 300 velas por llamada).
async function candles(product: string, from: number, to: number) {
  const closes = new Map<string, number>();
  for (let start = from; start < to; start += 300 * DAY) {
    const end = Math.min(start + 299 * DAY, to);
    const url = `${EXCHANGE}/products/${product}/candles?granularity=86400&start=${new Date(start).toISOString()}&end=${new Date(end).toISOString()}`;
    let rows: number[][] = [];
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await fetch(url, { headers: { "User-Agent": "crypto-dashboard" } });
      if (res.status === 429) {
        await sleep(1000 * (attempt + 1));
        continue;
      }
      if (res.ok) rows = (await res.json()) as number[][];
      break;
    }
    for (const [time, , , , close] of rows) closes.set(isoDay(time * 1000), close);
    await sleep(150);
  }
  return closes;
}

async function priceSeries(symbol: string, currency: string, from: number, to: number) {
  const p = await listProducts();
  if (p.has(`${symbol}-${currency}`)) return candles(`${symbol}-${currency}`, from, to);
  if (currency !== "USD" && p.has(`${symbol}-USD`)) {
    // Sin par en tu moneda: precio en USD convertido con el cambio implícito de BTC.
    const [usd, btcLocal, btcUsd] = await Promise.all([
      candles(`${symbol}-USD`, from, to),
      candles(`BTC-${currency}`, from, to),
      candles("BTC-USD", from, to),
    ]);
    const local = new Map<string, number>();
    for (const [d, v] of usd) {
      const rate =
        btcLocal.get(d) && btcUsd.get(d) ? btcLocal.get(d)! / btcUsd.get(d)! : null;
      if (rate) local.set(d, v * rate);
    }
    return local;
  }
  return new Map<string, number>();
}

async function allRows<T>(db: Db, table: string, select: string, order: string) {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from(table)
      .select(select)
      .order(order)
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...(data as T[]));
    if (data.length < 1000) return rows;
  }
}

type TxRow = {
  type: string;
  amount: number;
  value_eur_at_time: number | null;
  occurred_at: string;
  is_internal_transfer: boolean;
  assets: { symbol: string } | { symbol: string }[];
};

// Rellena price_history y los snapshots de los días que aún no tienen uno.
// Idempotente: se puede lanzar tantas veces como se quiera.
export async function backfillHistory() {
  const db = createAdminClient();
  const currency = await getCurrency();
  const stable = STABLE[currency] ?? new Set<string>();

  const txs = (
    await allRows<TxRow>(
      db,
      "transactions",
      "type, amount, value_eur_at_time, occurred_at, is_internal_transfer, assets(symbol)",
      "occurred_at",
    )
  )
    .map((t) => {
      const a = Array.isArray(t.assets) ? t.assets[0] : t.assets;
      return { ...t, symbol: underlying(a.symbol), amount: Number(t.amount) };
    })
    .filter(
      (t) => !t.is_internal_transfer && t.type !== "interno" && !FIAT.has(t.symbol),
    );
  if (txs.length === 0) return { days: 0 };

  const first = Date.parse(txs[0].occurred_at.slice(0, 10));
  const today = Date.parse(isoDay(Date.now()));
  const symbols = [...new Set(txs.map((t) => t.symbol))];

  // Precios: solo se descargan los días que faltan de cada activo.
  const prices = new Map<string, Map<string, number>>();
  const stored = await allRows<{ symbol: string; date: string; price_eur: number }>(
    db,
    "price_history",
    "symbol, date, price_eur",
    "date",
  );
  for (const r of stored) {
    if (!prices.has(r.symbol)) prices.set(r.symbol, new Map());
    prices.get(r.symbol)!.set(r.date, Number(r.price_eur));
  }
  for (const symbol of symbols) {
    if (stable.has(symbol)) continue;
    const known = prices.get(symbol) ?? new Map<string, number>();
    const lastKnown = [...known.keys()].sort().at(-1);
    const from = lastKnown ? Date.parse(lastKnown) + DAY : first;
    if (from >= today) continue;
    const fresh = await priceSeries(symbol, currency, from, today - DAY);
    if (fresh.size) {
      const rows = [...fresh].map(([date, price_eur]) => ({ symbol, date, price_eur }));
      for (let i = 0; i < rows.length; i += 1000) {
        const { error } = await db.from("price_history").upsert(rows.slice(i, i + 1000));
        if (error) throw error;
      }
      fresh.forEach((v, d) => known.set(d, v));
    }
    prices.set(symbol, known);
  }

  // Días que ya tienen snapshot real (tomado en su momento): no se tocan.
  const existing = await allRows<{ date: string }>(db, "portfolio_snapshots", "date", "date");
  const taken = new Set(existing.map((s) => s.date));

  const holdings = new Map<string, number>();
  const lastPrice = new Map<string, number>();
  let invested = 0;
  let i = 0;
  const rows: { date: string; total_value_eur: number; invested_eur: number; pnl_eur: number }[] = [];

  for (let t = first; t < today; t += DAY) {
    const day = isoDay(t);
    for (; i < txs.length && txs[i].occurred_at.slice(0, 10) <= day; i++) {
      const tx = txs[i];
      holdings.set(tx.symbol, (holdings.get(tx.symbol) ?? 0) + tx.amount);
      // Dinero metido neto, igual que take_snapshot (visión de fondo).
      const v = Number(tx.value_eur_at_time ?? 0);
      if ((tx.type === "compra" || tx.type === "recepcion") && tx.amount > 0) invested += v;
      if ((tx.type === "venta" || tx.type === "envio") && tx.amount < 0) invested -= v;
      // Precio implícito del propio movimiento: sirve para tokens sin
      // cotización en Coinbase (p. ej. los de la wallet).
      if (tx.value_eur_at_time && tx.amount) {
        lastPrice.set(tx.symbol, Math.abs(Number(tx.value_eur_at_time) / tx.amount));
      }
    }

    let total = 0;
    for (const [symbol, qty] of holdings) {
      if (qty <= 1e-12) continue;
      const price = stable.has(symbol) ? 1 : (prices.get(symbol)?.get(day) ?? lastPrice.get(symbol));
      if (price != null) {
        total += qty * price;
        lastPrice.set(symbol, price);
      }
    }
    if (!taken.has(day)) {
      rows.push({
        date: day,
        total_value_eur: total,
        invested_eur: invested,
        pnl_eur: total - invested,
      });
    }
  }

  for (let j = 0; j < rows.length; j += 1000) {
    const { error } = await db.from("portfolio_snapshots").upsert(rows.slice(j, j + 1000));
    if (error) throw error;
  }
  return { days: rows.length, symbols: symbols.length };
}
