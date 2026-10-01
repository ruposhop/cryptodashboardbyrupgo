import "server-only";
import { computeFifo, underlying, type FifoAsset } from "@/lib/fifo";
import { createClient } from "@/lib/supabase/server";
import { xirr } from "@/lib/xirr";

type Origin = "Coinbase" | "Wallet";

export type Position = FifoAsset & {
  name: string | null;
  weight: number;
  origins: Origin[];
};

export type Movement = {
  id: string;
  occurredAt: string;
  type: string;
  symbol: string;
  amount: number;
  valueEur: number | null;
  origin: Origin;
  chain: string | null;
  txHash: string | null;
};

export type Target = {
  symbol: string;
  priceEur: number;
  breakEvenEur: number;
  // Cuánto tiene que moverse el precio para que la posición quede a 0.
  changeToBreakEven: number;
  // Precio si toda la cartera sube lo mismo hasta P&L total = 0.
  uniformTargetEur: number;
  // Precio si solo sube este activo hasta P&L total = 0.
  soloTargetEur: number;
  soloChange: number;
};

type Joined<T> = T | T[] | null;
const one = <T,>(x: Joined<T>) => (Array.isArray(x) ? x[0] : x) as T;
const originOf = (type: string): Origin =>
  type === "coinbase" ? "Coinbase" : "Wallet";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// PostgREST devuelve como mucho 1000 filas por petición.
export async function allTransactions(supabase: Supabase) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("transactions")
      .select(
        "type, amount, value_eur_at_time, occurred_at, is_internal_transfer, tx_hash, trade_id:raw->trade->>id, pair:raw->>pair_tx_hash, assets(symbol)",
      )
      .order("occurred_at")
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

// Lee con la sesión del usuario: RLS decide qué se ve.
export async function getPortfolio() {
  const supabase = await createClient();

  const [balances, txs, movements, snapshot, runs] = await Promise.all([
    supabase
      .from("balances")
      .select("amount, value_eur, assets(symbol, name), sources(type, chain)"),
    allTransactions(supabase),
    supabase
      .from("transactions")
      .select(
        "id, occurred_at, type, amount, value_eur_at_time, chain, tx_hash, assets(symbol), sources(type)",
      )
      .eq("is_internal_transfer", false)
      .neq("type", "interno")
      .order("occurred_at", { ascending: false })
      .limit(25),
    supabase
      .from("portfolio_snapshots")
      .select("invested_eur")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("sync_runs")
      .select("finished_at, status, source_id")
      .not("finished_at", "is", null)
      .order("finished_at", { ascending: false })
      .limit(50),
  ]);

  // Coinbase (con source_id) y la wallet (sin él) se sincronizan por separado:
  // basta con que el último intento de uno de los dos haya fallado.
  const recentRuns = runs.data ?? [];
  const lastCoinbase = recentRuns.find((r) => r.source_id != null);
  const lastWallet = recentRuns.find((r) => r.source_id == null);
  const lastSync = recentRuns.find((r) => r.status === "ok")?.finished_at ?? null;

  const balanceBySymbol = new Map<string, { amount: number; valueEur: number }>();
  const meta = new Map<string, { name: string | null; origins: Origin[] }>();
  const byOrigin: Record<Origin, number> = { Coinbase: 0, Wallet: 0 };
  // Reparto por ubicación (MASTERPLAN §3.4): el exchange y cada red de la wallet.
  const byLocation = new Map<string, number>();

  for (const b of balances.data ?? []) {
    const asset = one(b.assets as Joined<{ symbol: string; name: string | null }>);
    const source = one(b.sources as Joined<{ type: string; chain: string | null }>);
    const origin = originOf(source.type);
    const value = Number(b.value_eur ?? 0);
    byOrigin[origin] += value;
    const location =
      origin === "Coinbase"
        ? "Coinbase"
        : (source.chain ?? "wallet").replace(/^./, (c) => c.toUpperCase());
    byLocation.set(location, (byLocation.get(location) ?? 0) + value);

    const bal = balanceBySymbol.get(asset.symbol) ?? { amount: 0, valueEur: 0 };
    bal.amount += Number(b.amount);
    bal.valueEur += value;
    balanceBySymbol.set(asset.symbol, bal);

    const key = underlying(asset.symbol);
    const m = meta.get(key) ?? { name: null, origins: [] };
    if (key === asset.symbol) m.name = asset.name;
    if (!m.origins.includes(origin)) m.origins.push(origin);
    meta.set(key, m);
  }

  const fifo = computeFifo(
    txs.map((t) => ({
      symbol: one(t.assets as Joined<{ symbol: string }>).symbol,
      type: t.type,
      amount: Number(t.amount),
      valueEur: t.value_eur_at_time != null ? Number(t.value_eur_at_time) : null,
      occurredAt: t.occurred_at,
      internal: t.is_internal_transfer,
    })),
    balanceBySymbol,
  );

  const total = byOrigin.Coinbase + byOrigin.Wallet;
  const unrealized = fifo.reduce((s, a) => s + a.unrealizedEur, 0);
  const realized = fifo.reduce((s, a) => s + a.realizedEur, 0);
  // Las recompensas ya no son ganancia al vender (entran a valor de mercado),
  // pero sí son dinero ganado: se suman al P&L total.
  const rewards = txs
    .filter((t) => t.type === "recompensa" && !t.is_internal_transfer)
    .reduce((s, t) => s + Number(t.value_eur_at_time ?? 0), 0);
  const fifoPnl = unrealized + realized + rewards;

  // Visión de fondo: dinero metido neto (compras y entradas externas, menos
  // ventas y salidas externas) frente a lo que vale hoy. Es la rentabilidad
  // real: incluye lo perdido en comisiones al cambiar de moneda.
  let contributed = 0;
  const cashFlows: { t: number; v: number }[] = [];
  for (const t of txs) {
    if (t.is_internal_transfer || t.type === "interno") continue;
    if (["EUR", "USD"].includes(one(t.assets as Joined<{ symbol: string }>).symbol)) continue;
    const value = Number(t.value_eur_at_time ?? 0);
    const amount = Number(t.amount);
    let cash = 0;
    if ((t.type === "compra" || t.type === "recepcion") && amount > 0) cash = -value;
    if ((t.type === "venta" || t.type === "envio") && amount < 0) cash = value;
    if (!cash) continue;
    contributed -= cash;
    cashFlows.push({ t: Date.parse(t.occurred_at), v: cash });
  }

  // Resultado total por moneda, contado como dinero que entra y sale:
  // lo que sacaste + lo que vale lo que te queda − lo que metiste. Las
  // recompensas y ajustes no costaron nada: no cuentan como metido, y lo que
  // valen ya está en "lo que queda" o en "lo que sacaste".
  // En un cambio, lo que "sacas" de la moneda que das es lo que recibes a
  // cambio: así la comisión del cambio se la apunta la moneda que diste.
  const swapKey = (t: (typeof txs)[number]) =>
    (t.trade_id as string | null) ?? (t.pair as string | null) ?? (t.tx_hash as string | null);
  const receivedInSwap = new Map<string, number>();
  for (const t of txs) {
    const key = swapKey(t);
    if (t.type === "swap" && Number(t.amount) > 0 && key) {
      receivedInSwap.set(key, Number(t.value_eur_at_time ?? 0));
    }
  }
  const flows = new Map<string, { inEur: number; outEur: number; rewardsEur: number }>();
  for (const t of txs) {
    if (t.is_internal_transfer || t.type === "interno") continue;
    const symbol = underlying(one(t.assets as Joined<{ symbol: string }>).symbol);
    const f = flows.get(symbol) ?? { inEur: 0, outEur: 0, rewardsEur: 0 };
    const value = Number(t.value_eur_at_time ?? 0);
    const amount = Number(t.amount);
    if (t.type === "recompensa") f.rewardsEur += value;
    else if (amount > 0 && t.type !== "ajuste") f.inEur += value;
    else if (amount < 0) {
      const key = swapKey(t);
      f.outEur += t.type === "swap" && key ? (receivedInSwap.get(key) ?? value) : value;
    }
    flows.set(symbol, f);
  }

  const positions: Position[] = fifo
    .filter((a) => a.valueEur >= 0.01)
    .map((a) => ({
      ...a,
      name: meta.get(a.symbol)?.name ?? null,
      origins: meta.get(a.symbol)?.origins ?? [],
      weight: total ? a.valueEur / total : 0,
    }))
    .sort((a, b) => b.valueEur - a.valueEur);

  // Lo que falta para que el P&L total (realizado + no realizado) sea ≥ 0.
  const pnl = total - contributed;
  // Rentabilidad anual equivalente (TIR): tiene en cuenta cuándo entró cada euro.
  const irr = xirr([...cashFlows, { t: Date.now(), v: total }]);
  const deficit = Math.max(0, -pnl);
  const uniformRise = total ? deficit / total : 0;
  const targets: Target[] = positions
    .filter((p) => p.valueEur >= 1 && p.priceEur && p.breakEvenEur != null)
    .map((p) => {
      const soloTargetEur = p.priceEur! + deficit / p.amount;
      return {
        symbol: p.symbol,
        priceEur: p.priceEur!,
        breakEvenEur: p.breakEvenEur!,
        changeToBreakEven: p.breakEvenEur! / p.priceEur! - 1,
        uniformTargetEur: p.priceEur! * (1 + uniformRise),
        soloTargetEur,
        soloChange: soloTargetEur / p.priceEur! - 1,
      };
    });

  // Avisos de calidad de datos: el cálculo es tan bueno como el historial.
  const warnings = fifo
    .filter((a) => a.orphanCostEur >= 5 || a.unmatchedEur >= 5 || (a.valueEur >= 1 && a.coverage < 0.99))
    .map((a) => ({
      symbol: a.symbol,
      orphanCostEur: a.orphanCostEur,
      unmatchedEur: a.unmatchedEur,
      coverage: a.coverage,
    }));

  return {
    total,
    byOrigin,
    byLocation: [...byLocation]
      .map(([label, value]) => ({ label, value }))
      .filter((l) => l.value >= 0.01)
      .sort((a, b) => b.value - a.value),
    // Todas las monedas con historia, también las que ya no tienes.
    assets: fifo.map((a) => {
      const f = flows.get(a.symbol) ?? { inEur: 0, outEur: 0, rewardsEur: 0 };
      return { ...a, ...f, resultEur: f.outEur + a.valueEur - f.inEur };
    }),
    invested:
      snapshot.data?.invested_eur != null ? Number(snapshot.data.invested_eur) : null,
    pnl,
    contributed,
    fifoPnl,
    irr,
    unrealized,
    realized,
    rewards,
    deficit,
    uniformRise,
    positions,
    targets,
    warnings,
    movements: (movements.data ?? []).map(
      (m): Movement => ({
        id: m.id,
        occurredAt: m.occurred_at,
        type: m.type,
        symbol: one(m.assets as Joined<{ symbol: string }>).symbol,
        amount: Number(m.amount),
        valueEur: m.value_eur_at_time != null ? Number(m.value_eur_at_time) : null,
        origin: originOf(one(m.sources as Joined<{ type: string }>).type),
        chain: m.chain,
        txHash: m.tx_hash,
      }),
    ),
    lastSync,
    // El cron corre al menos una vez al día: más de 26 h sin datos es raro.
    syncStale: !lastSync || Date.now() - Date.parse(lastSync) > 26 * 3600 * 1000,
    syncFailing: lastCoinbase?.status === "error" || lastWallet?.status === "error",
  };
}

// Serie diaria para el gráfico de evolución (portfolio_snapshots).
export async function getHistory() {
  const supabase = await createClient();
  const points: { date: string; value: number; invested: number }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("portfolio_snapshots")
      .select("date, total_value_eur, invested_eur")
      .order("date")
      .range(from, from + 999);
    if (error) throw error;
    points.push(
      ...data.map((s) => ({
        date: s.date as string,
        value: Number(s.total_value_eur),
        invested: Number(s.invested_eur ?? 0),
      })),
    );
    if (data.length < 1000) return points;
  }
}
