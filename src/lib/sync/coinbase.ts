import "server-only";
import { coinbaseGet } from "@/lib/coinbase";
import { rememberDetectedCurrency } from "@/lib/currency";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  replaceBalances,
  upsertAssets,
  upsertTransactions,
  withSyncRun,
} from "./common";

type Money = { amount: string; currency: string };
type Page<T> = { data: T[]; pagination?: { next_uri: string | null } };
type Account = {
  id: string;
  currency: { code: string; name: string } | string;
  balance: Money;
};
type Tx = {
  id: string;
  type: string;
  status: string;
  amount: Money;
  native_amount?: Money;
  created_at: string;
  network?: { hash?: string; network_name?: string };
  from?: { name?: string };
};

// Tipos de Coinbase → tipos del dashboard (MASTERPLAN §3.5).
const TYPE_MAP: Record<string, string> = {
  buy: "compra",
  sell: "venta",
  trade: "swap",
  advanced_trade_fill: "swap",
  staking_reward: "recompensa",
  inflation_reward: "recompensa",
  interest: "recompensa",
  earn_payout: "recompensa",
  // Mover entre la cuenta y el staking no cambia lo que tengo.
  staking_transfer: "interno",
  unstaking_transfer: "interno",
  retail_eth2_deprecation: "interno",
  retail_simple_price_improvement: "ajuste",
  fiat_deposit: "deposito",
  fiat_withdrawal: "retiro",
};

function mapType(tx: Tx) {
  if (TYPE_MAP[tx.type]) return TYPE_MAP[tx.type];
  // Premios de los cursos de Coinbase Earn y el staking antiguo de ADA ("tx"):
  // no costaron nada, no son dinero metido.
  if (tx.type === "tx") return "recompensa";
  if (tx.type === "send" && Number(tx.amount.amount) > 0 && tx.from?.name === "Coinbase Earn") {
    return "recompensa";
  }
  return Number(tx.amount.amount) < 0 ? "envio" : "recepcion";
}

async function getAll<T>(firstPath: string) {
  const all: T[] = [];
  let path: string | null = firstPath;
  while (path) {
    const page: Page<T> = await coinbaseGet<Page<T>>(path);
    all.push(...page.data);
    path = page.pagination?.next_uri ?? null;
  }
  return all;
}

async function rates(currency: string) {
  // Endpoint público: cuántas unidades de cada moneda vale 1 EUR (o 1 USD…).
  const res = await fetch(
    `https://api.coinbase.com/v2/exchange-rates?currency=${currency}`,
    { cache: "no-store" },
  );
  const json = (await res.json()) as {
    data: { rates: Record<string, string> };
  };
  return json.data.rates;
}

async function coinbaseSourceId() {
  const db = createAdminClient();
  const { data } = await db
    .from("sources")
    .select("id")
    .eq("type", "coinbase")
    .maybeSingle();
  if (data) return data.id as string;
  const created = await db
    .from("sources")
    .insert({ type: "coinbase", label: "Coinbase" })
    .select("id")
    .single();
  if (created.error) throw created.error;
  return created.data.id as string;
}

export async function syncCoinbase() {
  const db = createAdminClient();
  const sourceId = await coinbaseSourceId();

  return withSyncRun(db, sourceId, async () => {
    const accounts = await getAll<Account>("/v2/accounts?limit=100");
    const txsByAccount = new Map<string, Tx[]>();
    for (const a of accounts) {
      txsByAccount.set(a.id, await getAll<Tx>(`/v2/accounts/${a.id}/transactions?limit=100`));
    }

    // Moneda en la que Coinbase valora tus movimientos (la de tu cuenta).
    const seen = new Map<string, number>();
    for (const txs of txsByAccount.values()) {
      for (const tx of txs) {
        const c = tx.native_amount?.currency;
        if (c) seen.set(c, (seen.get(c) ?? 0) + 1);
      }
    }
    const detected = [...seen].sort((x, y) => y[1] - x[1])[0]?.[0] ?? null;
    const currency = await rememberDetectedCurrency(detected);
    const fx = await rates(currency);

    const code = (a: Account) =>
      typeof a.currency === "string" ? a.currency : a.currency.code;

    const assetId = await upsertAssets(
      db,
      accounts.map((a) => ({
        symbol: code(a),
        name: typeof a.currency === "string" ? null : a.currency.name,
      })),
    );

    // Una moneda puede tener varias cuentas: se suman.
    const totals = new Map<string, number>();
    for (const a of accounts) {
      totals.set(code(a), (totals.get(code(a)) ?? 0) + Number(a.balance.amount));
    }
    await replaceBalances(
      db,
      sourceId,
      [...totals]
        .filter(([, amount]) => amount !== 0)
        .map(([symbol, amount]) => ({
          asset_id: assetId.get(symbol)!,
          amount,
          value_eur: fx[symbol] ? amount / Number(fx[symbol]) : null,
        })),
    );

    let transactions = 0;
    for (const a of accounts) {
      const txs = txsByAccount.get(a.id) ?? [];
      const rows = txs
        .filter((tx) => tx.status === "completed")
        .map((tx) => ({
          source_id: sourceId,
          external_id: tx.id,
          type: mapType(tx),
          raw_type: tx.type,
          asset_id: assetId.get(code(a)),
          amount: Number(tx.amount.amount),
          value_eur_at_time:
            tx.native_amount && tx.native_amount.currency === currency
              ? Math.abs(Number(tx.native_amount.amount))
              : null,
          tx_hash: tx.network?.hash ?? null,
          chain: tx.network?.network_name ?? null,
          occurred_at: tx.created_at,
          raw: tx,
        }));
      await upsertTransactions(db, rows);
      transactions += rows.length;
    }

    return { accounts: accounts.length, transactions };
  });
}
