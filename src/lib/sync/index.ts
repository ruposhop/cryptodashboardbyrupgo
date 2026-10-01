import "server-only";
import { checkPriceAlerts, notifySyncFailure, notifyWalletMovements } from "@/lib/alerts";
import { backfillHistory } from "@/lib/history";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncCoinbase } from "./coinbase";
import { syncWallet } from "./wallet";
import { ensureOwner } from "@/lib/owner";

// Zerion (plan gratuito): ~2000 peticiones/mes. Cada sincronización de una
// wallet gasta 2. Con el cron cada 6 h son ~240/mes por wallet; el botón
// manual puede forzarla como mucho cada 15 min.
const WALLET_EVERY_MS = { cron: 6 * 3600 * 1000, manual: 15 * 60 * 1000 };
const TOLERANCE_MS = 5 * 60 * 1000;

async function attempt<T>(name: string, job: () => Promise<T>) {
  try {
    return { ok: true as const, result: await job() };
  } catch (e) {
    console.error(`sync ${name}`, e);
    const error = e instanceof Error ? e.message : String(e);
    return { ok: false as const, error };
  }
}

async function walletIsDue(trigger: "cron" | "manual") {
  const db = createAdminClient();
  const { data } = await db
    .from("sync_runs")
    .select("started_at")
    .is("source_id", null)
    // Cuenta también los fallidos y los que están en marcha: si Zerion falla,
    // no se reintenta en cada clic; y dos clics seguidos no lanzan dos.
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return true;
  const elapsed = Date.now() - new Date(data.started_at).getTime();
  return elapsed >= WALLET_EVERY_MS[trigger] - TOLERANCE_MS;
}

// Sincroniza todas las fuentes; si una falla, las demás siguen.
export async function syncAll(trigger: "cron" | "manual" = "cron") {
  const db = createAdminClient();
  await ensureOwner();
  const { data: wallets } = await db
    .from("sources")
    .select("address")
    .eq("type", "wallet")
    .eq("active", true);
  const addresses = [
    ...new Set((wallets ?? []).map((w) => (w.address as string).toLowerCase())),
  ];
  const walletDue = await walletIsDue(trigger);

  const results = {
    coinbase: await attempt("coinbase", syncCoinbase),
    wallets: walletDue
      ? await Promise.all(
          addresses.map((a) => attempt(`wallet ${a}`, () => syncWallet(a))),
        )
      : [],
    walletSkipped: !walletDue,
  };

  const fresh = results.wallets.flatMap((w) => (w.ok ? w.result.fresh : []));
  if (fresh.length) await attempt("aviso wallet", () => notifyWalletMovements(fresh));

  const { error: internalError } = await db.rpc("mark_internal_transfers");
  if (internalError) console.error("mark_internal_transfers", internalError);
  const { error: snapshotError } = await db.rpc("take_snapshot");
  if (snapshotError) console.error("take_snapshot", snapshotError);

  // Si algún día se quedó sin snapshot (cron caído), se reconstruye.
  const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);
  const { data: gap } = await db
    .from("portfolio_snapshots")
    .select("date")
    .eq("date", yesterday)
    .maybeSingle();
  if (!gap) await attempt("backfill", backfillHistory);

  await attempt("alertas", checkPriceAlerts);

  // Solo el cron avisa: si falla el botón manual, ya lo estás viendo.
  if (trigger === "cron") {
    const failures = [
      ...(results.coinbase.ok ? [] : [{ name: "Coinbase", error: results.coinbase.error }]),
      ...results.wallets.flatMap((w, i) =>
        w.ok ? [] : [{ name: `Wallet ${shortAddress(addresses[i])}`, error: w.error }],
      ),
    ];
    if (failures.length) await attempt("aviso fallo", () => notifySyncFailure(failures));
  }

  return results;
}

const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

// Peticiones a Zerion en el mes natural en curso.
export async function zerionCallsThisMonth() {
  const db = createAdminClient();
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const { data } = await db
    .from("sync_runs")
    .select("api_calls")
    .is("source_id", null)
    .gte("started_at", start.toISOString());
  return (data ?? []).reduce((s, r) => s + (r.api_calls ?? 0), 0);
}
