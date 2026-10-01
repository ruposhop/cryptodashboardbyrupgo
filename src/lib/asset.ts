import "server-only";
import { underlying } from "@/lib/fifo";
import { getPortfolio } from "@/lib/portfolio";
import { createClient } from "@/lib/supabase/server";

const ALIASES_OF = (symbol: string) =>
  [symbol, "cbBTC", "WBTC", "WETH", "ETH2"].filter((s) => underlying(s) === symbol);

// Detalle de un activo (MASTERPLAN §3.6): posición FIFO, operaciones y precio.
export async function getAssetDetail(rawSymbol: string) {
  const symbol = underlying(rawSymbol);
  const supabase = await createClient();

  const [portfolio, prices, txs] = await Promise.all([
    getPortfolio(),
    (async () => {
      const rows: { date: string; price: number }[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from("price_history")
          .select("date, price_eur")
          .eq("symbol", symbol)
          .order("date")
          .range(from, from + 999);
        if (error) throw error;
        rows.push(...data.map((r) => ({ date: r.date as string, price: Number(r.price_eur) })));
        if (data.length < 1000) return rows;
      }
    })(),
    (async () => {
      const rows = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from("transactions")
          .select(
            "id, occurred_at, type, amount, value_eur_at_time, is_internal_transfer, chain, tx_hash, assets!inner(symbol), sources(type)",
          )
          .in("assets.symbol", ALIASES_OF(symbol))
          .order("occurred_at", { ascending: false })
          .range(from, from + 999);
        if (error) throw error;
        rows.push(...data);
        if (data.length < 1000) return rows;
      }
    })(),
  ]);

  const position = portfolio.positions.find((p) => p.symbol === symbol) ?? null;
  const target = portfolio.targets.find((t) => t.symbol === symbol) ?? null;

  const operations = txs.map((t) => {
    const source = Array.isArray(t.sources) ? t.sources[0] : t.sources;
    const amount = Number(t.amount);
    const value = t.value_eur_at_time != null ? Number(t.value_eur_at_time) : null;
    const internal = (t.is_internal_transfer as boolean) || t.type === "interno";
    return {
      id: t.id as string,
      occurredAt: t.occurred_at as string,
      type: internal ? "interno" : (t.type as string),
      amount,
      valueEur: value,
      unitPrice: value != null && amount ? Math.abs(value / amount) : null,
      origin: (source as { type: string } | null)?.type === "coinbase" ? "Coinbase" : "Wallet",
      chain: t.chain as string | null,
      txHash: t.tx_hash as string | null,
    };
  });

  const rewards = operations.filter((o) => o.type === "recompensa");
  const trades = operations.filter((o) => o.type !== "recompensa" && o.type !== "interno");

  // Resumen de la moneda: lo que entró, lo que salió y cómo.
  const sum = (list: typeof operations) => ({
    count: list.length,
    amount: list.reduce((s, o) => s + Math.abs(o.amount), 0),
    valueEur: list.reduce((s, o) => s + (o.valueEur ?? 0), 0),
  });
  const external = operations.filter((o) => o.type !== "interno");
  const summary = {
    bought: sum(external.filter((o) => o.amount > 0 && ["compra", "swap"].includes(o.type))),
    sold: sum(external.filter((o) => o.amount < 0 && ["venta", "swap"].includes(o.type))),
    received: sum(external.filter((o) => o.amount > 0 && o.type === "recepcion")),
    sent: sum(external.filter((o) => o.amount < 0 && o.type === "envio")),
    firstAt: operations.at(-1)?.occurredAt ?? null,
    total: operations.length,
  };

  const series = [...prices];
  if (position?.priceEur) {
    const today = new Date().toISOString().slice(0, 10);
    if (series.at(-1)?.date !== today) series.push({ date: today, price: position.priceEur });
  }

  // Marcas en el gráfico: entradas y salidas con precio conocido.
  const markers = trades
    .filter((o) => o.unitPrice != null)
    .map((o) => ({
      date: o.occurredAt.slice(0, 10),
      price: o.unitPrice!,
      side: o.amount > 0 ? ("in" as const) : ("out" as const),
      type: o.type,
    }));

  return {
    symbol,
    name: position?.name ?? null,
    position,
    target,
    realizedEur: portfolio.assets.find((p) => p.symbol === symbol)?.realizedEur ?? null,
    coin: portfolio.assets.find((p) => p.symbol === symbol) ?? null,
    rewards: {
      count: rewards.length,
      amount: rewards.reduce((s, r) => s + r.amount, 0),
      valueEur: rewards.reduce((s, r) => s + (r.valueEur ?? 0), 0),
    },
    trades,
    operations,
    summary,
    series,
    markers,
  };
}
