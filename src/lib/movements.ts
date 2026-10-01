import "server-only";
import { createClient } from "@/lib/supabase/server";

export const TYPE_LABEL: Record<string, string> = {
  compra: "Compra",
  venta: "Venta",
  swap: "Swap",
  envio: "Envío",
  recepcion: "Recepción",
  recompensa: "Recompensa",
  deposito: "Depósito",
  retiro: "Retiro",
  ajuste: "Ajuste",
};

const EXPLORER: Record<string, string> = {
  ethereum: "https://etherscan.io/tx/",
  base: "https://basescan.org/tx/",
  arbitrum: "https://arbiscan.io/tx/",
  polygon: "https://polygonscan.com/tx/",
  optimism: "https://optimistic.etherscan.io/tx/",
  solana: "https://solscan.io/tx/",
  bitcoin: "https://mempool.space/tx/",
};

export function explorerUrl(chain: string | null, txHash: string | null) {
  const base = chain ? EXPLORER[chain.toLowerCase()] : undefined;
  return base && txHash ? base + txHash : null;
}

export type MovementFilters = {
  from?: string;
  to?: string;
  asset?: string;
  type?: string;
  origin?: "coinbase" | "wallet";
  internal?: boolean;
  page?: number;
};

export const PAGE_SIZE = 50;

const isDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

// Lista unificada de las dos carteras (MASTERPLAN §3.5), filtrada en la BD.
export async function listMovements(f: MovementFilters) {
  const supabase = await createClient();
  const page = Math.max(1, f.page ?? 1);

  let q = supabase
    .from("transactions")
    .select(
      "id, occurred_at, type, amount, value_eur_at_time, chain, tx_hash, is_internal_transfer, assets!inner(symbol), sources!inner(type)",
      { count: "exact" },
    )
    .order("occurred_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (!f.internal) q = q.eq("is_internal_transfer", false).neq("type", "interno");
  if (isDate(f.from)) q = q.gte("occurred_at", f.from!);
  if (isDate(f.to)) q = q.lt("occurred_at", `${f.to}T23:59:59.999Z`);
  if (f.asset) q = q.eq("assets.symbol", f.asset);
  if (f.type && TYPE_LABEL[f.type]) q = q.eq("type", f.type);
  if (f.origin) q = q.eq("sources.type", f.origin);

  const { data, count, error } = await q;
  if (error) throw error;

  return {
    page,
    total: count ?? 0,
    rows: (data ?? []).map((m) => {
      const asset = Array.isArray(m.assets) ? m.assets[0] : m.assets;
      const source = Array.isArray(m.sources) ? m.sources[0] : m.sources;
      return {
        id: m.id as string,
        occurredAt: m.occurred_at as string,
        type: m.type as string,
        symbol: (asset as { symbol: string }).symbol,
        amount: Number(m.amount),
        valueEur: m.value_eur_at_time != null ? Number(m.value_eur_at_time) : null,
        origin: (source as { type: string }).type === "coinbase" ? "Coinbase" : "Wallet",
        chain: m.chain as string | null,
        txHash: m.tx_hash as string | null,
        internal: m.is_internal_transfer as boolean,
      };
    }),
  };
}

// Solo activos con algún movimiento (fuera cuentas vacías y tokens spam).
export async function listAssetSymbols() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("assets")
    .select("symbol, transactions!inner(id)")
    .limit(1, { referencedTable: "transactions" })
    .order("symbol");
  return (data ?? []).map((a) => a.symbol as string).filter((s) => s !== "EUR");
}
