import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

type Db = SupabaseClient;

export async function upsertAssets(
  db: Db,
  assets: { symbol: string; name?: string | null; logo?: string | null }[],
) {
  const unique = new Map(assets.map((a) => [a.symbol, a]));
  if (unique.size === 0) return new Map<string, string>();
  const { data, error } = await db
    .from("assets")
    .upsert(
      [...unique.values()].map(({ symbol, name, logo }) => ({
        symbol,
        name: name ?? null,
        logo: logo ?? null,
      })),
      { onConflict: "symbol", ignoreDuplicates: false },
    )
    .select("id, symbol");
  if (error) throw error;
  return new Map(data.map((a) => [a.symbol as string, a.id as string]));
}

export async function upsertTransactions(db: Db, rows: object[]) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db
      .from("transactions")
      .upsert(rows.slice(i, i + 500), { onConflict: "source_id,external_id" });
    if (error) throw error;
  }
}

// Reemplaza los saldos de una fuente: lo que ya no está se borra.
export async function replaceBalances(
  db: Db,
  sourceId: string,
  rows: { asset_id: string; amount: number; value_eur: number | null }[],
) {
  const syncedAt = new Date().toISOString();
  const { error: delError } = await db
    .from("balances")
    .delete()
    .eq("source_id", sourceId);
  if (delError) throw delError;
  if (rows.length === 0) return;
  const { error } = await db
    .from("balances")
    .insert(rows.map((r) => ({ ...r, source_id: sourceId, synced_at: syncedAt })));
  if (error) throw error;
}

export async function withSyncRun<T>(
  db: Db,
  sourceId: string | null,
  job: () => Promise<T>,
  apiCalls?: () => number,
) {
  const { data: run } = await db
    .from("sync_runs")
    .insert({ source_id: sourceId, status: "running" })
    .select("id")
    .single();
  try {
    const result = await job();
    await db
      .from("sync_runs")
      .update({
        status: "ok",
        finished_at: new Date().toISOString(),
        api_calls: apiCalls?.() ?? null,
      })
      .eq("id", run!.id);
    return result;
  } catch (e) {
    const message =
      e instanceof Error ? e.message : JSON.stringify(e).slice(0, 1000);
    await db
      .from("sync_runs")
      .update({
        status: "error",
        finished_at: new Date().toISOString(),
        error: message.slice(0, 1000),
        api_calls: apiCalls?.() ?? null,
      })
      .eq("id", run!.id);
    throw new Error(message);
  }
}
