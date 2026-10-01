import "server-only";
import { getCurrency } from "@/lib/currency";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  replaceBalances,
  upsertAssets,
  upsertTransactions,
  withSyncRun,
} from "./common";

const API = "https://api.zerion.io/v1";

type Fungible = { symbol: string; name: string; icon?: { url: string } | null };
type Position = {
  attributes: {
    quantity: { float: number };
    value: number | null;
    fungible_info: Fungible;
  };
  relationships: { chain: { data: { id: string } } };
};
type Transfer = {
  direction: "in" | "out" | "self";
  quantity: { float: number };
  value: number | null;
  fungible_info?: Fungible;
};
type Tx = {
  id: string;
  attributes: {
    operation_type: string;
    hash: string;
    mined_at: string;
    status: string;
    fee?: { value: number | null } | null;
    transfers: Transfer[];
  };
  relationships: { chain: { data: { id: string } } };
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// El plan gratuito de Zerion tiene un cupo mensual de peticiones: se cuentan
// todas (también los reintentos) y se guardan en sync_runs.api_calls.
type Usage = { calls: number };

async function zerion<T>(url: string, usage: Usage): Promise<T> {
  const auth = Buffer.from(`${process.env.ZERION_API_KEY}:`).toString("base64");
  let res: Response;
  // También limita peticiones por segundo: pocos reintentos y con espera.
  for (let attempt = 0; ; attempt++) {
    usage.calls++;
    res = await fetch(url, {
      headers: { Authorization: `Basic ${auth}`, accept: "application/json" },
      cache: "no-store",
    });
    if (res.status !== 429 || attempt === 2) break;
    await sleep(1000 * 2 ** attempt);
  }
  if (!res.ok) {
    throw new Error(
      `Zerion ${res.status}: ${(await res.text()).slice(0, 300)}`,
    );
  }
  return res.json() as Promise<T>;
}

// Solo se siguen páginas del propio Zerion (la key va en la cabecera) y con
// un tope, para no gastar el cupo si la paginación se volviera loca.
const MAX_PAGES = 20;

async function getAll<T>(firstUrl: string, usage: Usage) {
  const all: T[] = [];
  let url: string | null = firstUrl;
  for (let page = 0; url; page++) {
    if (new URL(url).origin !== "https://api.zerion.io" || page >= MAX_PAGES) {
      throw new Error(`Paginación de Zerion no válida: ${url.slice(0, 80)}`);
    }
    const res: { data: T[]; links?: { next?: string } } = await zerion(url, usage);
    all.push(...res.data);
    url = res.links?.next ?? null;
  }
  return all;
}

const TYPE_MAP: Record<string, string> = {
  trade: "swap",
  send: "envio",
  receive: "recepcion",
};

// Una fuente por dirección y red (MASTERPLAN §8).
async function sourceIds(address: string, chains: string[]) {
  const db = createAdminClient();
  const { data: existing } = await db
    .from("sources")
    .select("id, chain")
    .eq("type", "wallet")
    .ilike("address", address);
  const ids = new Map(
    (existing ?? []).map((s) => [s.chain as string, s.id as string]),
  );

  const missing = chains.filter((c) => !ids.has(c));
  if (missing.length) {
    const { data, error } = await db
      .from("sources")
      .insert(
        missing.map((chain) => ({
          type: "wallet",
          label: "Coinbase Wallet",
          address,
          chain,
        })),
      )
      .select("id, chain");
    if (error) throw error;
    data.forEach((s) => ids.set(s.chain as string, s.id as string));
  }
  return ids;
}

// Solo se piden los movimientos desde el último guardado (con un día de margen
// por si alguno llegó tarde): normalmente cabe en una sola petición.
async function lastTxTime(address: string) {
  const db = createAdminClient();
  const { data } = await db
    .from("transactions")
    .select("occurred_at, sources!inner(type, address)")
    .eq("sources.type", "wallet")
    .ilike("sources.address", address)
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? new Date(data.occurred_at).getTime() - 24 * 3600 * 1000 : null;
}

export async function syncWallet(address: string) {
  const db = createAdminClient();
  const base = `${API}/wallets/${address}`;
  const usage: Usage = { calls: 0 };
  const currency = await getCurrency();

  return withSyncRun(
    db,
    null,
    async () => {
      const positions = await getAll<Position>(
        `${base}/positions/?filter[positions]=only_simple&filter[trash]=only_non_trash&currency=${currency.toLowerCase()}`,
        usage,
      );
      const since = await lastTxTime(address);
      const txs = await getAll<Tx>(
        `${base}/transactions/?filter[trash]=only_non_trash&currency=${currency.toLowerCase()}&page[size]=100` +
          (since ? `&filter[min_mined_at]=${since}` : ""),
        usage,
      );

      const chainOf = (x: {
        relationships: { chain: { data: { id: string } } };
      }) => x.relationships.chain.data.id;
      // Incluye las redes ya conocidas: si un saldo queda a 0 hay que borrarlo.
      const sources = await sourceIds(address, [
        ...new Set([...positions.map(chainOf), ...txs.map(chainOf)]),
      ]);
      const chains = [...sources.keys()];

      const fungibles = [
        ...positions.map((p) => p.attributes.fungible_info),
        ...txs.flatMap((t) =>
          t.attributes.transfers.flatMap((tr) => tr.fungible_info ?? []),
        ),
      ];
      const assetId = await upsertAssets(
        db,
        fungibles.map((f) => ({
          symbol: f.symbol,
          name: f.name,
          logo: f.icon?.url,
        })),
      );

      for (const chain of chains) {
        // Sin precio = token sin liquidez o spam (MASTERPLAN §10): fuera.
        const totals = new Map<string, { amount: number; value: number }>();
        for (const p of positions.filter((p) => chainOf(p) === chain)) {
          if (p.attributes.value == null) continue;
          const s = p.attributes.fungible_info.symbol;
          const t = totals.get(s) ?? { amount: 0, value: 0 };
          t.amount += p.attributes.quantity.float;
          t.value += p.attributes.value;
          totals.set(s, t);
        }
        await replaceBalances(
          db,
          sources.get(chain)!,
          [...totals].map(([symbol, t]) => ({
            asset_id: assetId.get(symbol)!,
            amount: t.amount,
            value_eur: t.value,
          })),
        );
      }

      const rows = txs
        .filter((t) => t.attributes.status === "confirmed")
        .flatMap((t) => {
          const transfers = t.attributes.transfers.filter(
            (tr) => tr.fungible_info && tr.direction !== "self",
          );
          // Entra un token y sale otro en la misma tx: es un swap (p. ej. "execute").
          const isSwap =
            transfers.some((tr) => tr.direction === "in") &&
            transfers.some((tr) => tr.direction === "out");
          return transfers.map((tr, i) => ({
            source_id: sources.get(chainOf(t)),
            external_id: `${t.id}:${i}`,
            type: isSwap
              ? "swap"
              : (TYPE_MAP[t.attributes.operation_type] ??
                (tr.direction === "in" ? "recepcion" : "envio")),
            raw_type: t.attributes.operation_type,
            asset_id: assetId.get(tr.fungible_info!.symbol),
            amount:
              tr.direction === "in" ? tr.quantity.float : -tr.quantity.float,
            value_eur_at_time: tr.value,
            fee_eur: i === 0 ? (t.attributes.fee?.value ?? null) : null,
            tx_hash: t.attributes.hash,
            chain: chainOf(t),
            occurred_at: t.attributes.mined_at,
            raw: t,
          }));
        });
      // Movimientos que no estaban guardados: se avisan por email (salvo en la
      // primera importación de una wallet, que traería todo el historial).
      const ids = since ? rows.map((r) => r.external_id) : [];
      const { data: known } = ids.length
        ? await db.from("transactions").select("external_id").in("external_id", ids)
        : { data: [] };
      const knownIds = new Set((known ?? []).map((k) => k.external_id as string));
      const fresh = rows
        .filter((r) => !knownIds.has(r.external_id))
        .map((r) => ({
          type: r.type,
          symbol: [...assetId].find(([, id]) => id === r.asset_id)?.[0] ?? "?",
          amount: r.amount,
          valueEur: r.value_eur_at_time,
          chain: r.chain,
          txHash: r.tx_hash,
          occurredAt: r.occurred_at,
        }));

      await upsertTransactions(db, rows);

      return {
        chains,
        positions: positions.length,
        transactions: rows.length,
        fresh,
        apiCalls: usage.calls,
      };
    },
    () => usage.calls,
  );
}
