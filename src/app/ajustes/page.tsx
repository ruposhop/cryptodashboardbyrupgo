import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { formatDate, formatPrice } from "@/lib/format";
import { requireOwner } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { zerionCallsThisMonth } from "@/lib/sync";
import { setWalletActive } from "./actions";
import { AddWalletForm } from "./add-wallet-form";

type Source = {
  id: string;
  type: string;
  label: string;
  address: string | null;
  chain: string | null;
  active: boolean;
};

async function getSettings() {
  const db = createAdminClient();
  const [{ data: sources }, { data: runs }, zerionCalls, { data: alerts }] = await Promise.all([
    db.from("sources").select("id, type, label, address, chain, active").order("created_at"),
    db
      .from("sync_runs")
      .select("source_id, status, started_at, error")
      .order("started_at", { ascending: false })
      .limit(50),
    zerionCallsThisMonth(),
    db
      .from("price_alerts")
      .select("id, symbol, direction, price_eur, note")
      .eq("active", true)
      .order("symbol"),
  ]);

  const all = (sources ?? []) as Source[];
  const coinbase = all.find((s) => s.type === "coinbase");
  const lastRun = (match: (r: { source_id: string | null }) => boolean) =>
    (runs ?? []).find(match) ?? null;

  // Una wallet = una dirección; cada red en la que aparece es una fuente.
  const wallets = new Map<string, { address: string; label: string; active: boolean; chains: string[] }>();
  for (const s of all.filter((s) => s.type === "wallet" && s.address)) {
    const key = s.address!.toLowerCase();
    const w = wallets.get(key) ?? { address: s.address!, label: s.label, active: false, chains: [] };
    if (s.chain && !w.chains.includes(s.chain)) w.chains.push(s.chain);
    w.active ||= s.active;
    wallets.set(key, w);
  }

  return {
    coinbaseRun: coinbase ? lastRun((r) => r.source_id === coinbase.id) : null,
    walletRun: lastRun((r) => r.source_id === null),
    wallets: [...wallets.values()],
    zerionCalls,
    alerts: alerts ?? [],
  };
}

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export default async function Ajustes() {
  await requireOwner();
  const s = await getSettings();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6 sm:px-8 sm:py-8">
      <AppHeader current="/ajustes" />
      <h1 className="mt-8 text-2xl font-semibold tracking-tight">Ajustes</h1>

      <section aria-labelledby="fuentes" className="mt-8">
        <h2 id="fuentes" className="text-sm uppercase tracking-wider text-muted">
          Conexiones
        </h2>
        <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
          <Status
            name="Coinbase (exchange)"
            detail="API key de solo lectura, configurada en Vercel. No se introduce aquí."
            run={s.coinbaseRun}
            every="cada hora"
          />
          <Status
            name="Wallets (Zerion)"
            detail={`${s.zerionCalls} / 2000 peticiones este mes`}
            run={s.walletRun}
            every="cada 6 h"
          />
        </ul>
      </section>

      <section aria-labelledby="wallets" className="mt-10">
        <h2 id="wallets" className="text-sm uppercase tracking-wider text-muted">
          Direcciones de wallet
        </h2>
        <p className="mt-2 text-sm text-muted">
          Solo direcciones públicas. La app nunca te pedirá claves privadas ni la frase
          semilla.
        </p>
        <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
          {s.wallets.length === 0 && (
            <li className="px-4 py-4 text-sm text-muted">No hay direcciones.</li>
          )}
          {s.wallets.map((w) => (
            <li key={w.address} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm">
                  {w.label}{" "}
                  <span className="font-mono text-muted" title={w.address}>
                    {short(w.address)}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {w.chains.join(" · ") || "sin redes aún"}
                  {!w.active && " · desactivada"}
                </p>
              </div>
              <form action={setWalletActive}>
                <input type="hidden" name="address" value={w.address} />
                <input type="hidden" name="active" value={w.active ? "0" : "1"} />
                <button type="submit" className="text-sm text-muted hover:text-foreground">
                  {w.active ? "Desactivar" : "Activar"}
                </button>
              </form>
            </li>
          ))}
        </ul>
        <AddWalletForm />
      </section>

      <section aria-labelledby="alertas" className="mt-10">
        <h2 id="alertas" className="text-sm uppercase tracking-wider text-muted">
          Alertas de precio activas
        </h2>
        <p className="mt-2 text-sm text-muted">
          Se comprueban cada hora y llegan a tu email. Se crean desde el detalle de cada
          activo. También recibes un email cuando entra o sale algo de tu wallet.
        </p>
        <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
          {s.alerts.length === 0 && (
            <li className="px-4 py-4 text-sm text-muted">Ninguna alerta activa.</li>
          )}
          {s.alerts.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
              <Link href={`/activo/${encodeURIComponent(a.symbol)}`} className="hover:underline">
                <span className="font-medium">{a.symbol}</span>{" "}
                <span className="font-mono tabular-nums">
                  {a.direction === "above" ? "≥" : "≤"} {formatPrice(Number(a.price_eur))}
                </span>
              </Link>
              <span className="text-xs text-muted">{a.note}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function Status({
  name,
  detail,
  run,
  every,
}: {
  name: string;
  detail: string;
  run: { status: string; started_at: string; error: string | null } | null;
  every: string;
}) {
  const ok = run?.status === "ok";
  return (
    <li className="px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm">{name}</p>
        <span className={`text-xs ${!run ? "text-muted" : ok ? "text-foreground" : "text-loss"}`}>
          {!run ? "Sin sincronizar" : ok ? "● Conectado" : run.status === "running" ? "Sincronizando…" : "● Error"}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-muted">
        {detail} · se actualiza {every}
        {run && ` · última: ${formatDate(run.started_at)}`}
      </p>
      {run?.status === "error" && run.error && (
        <p className="mt-1 text-xs text-loss">{run.error.slice(0, 160)}</p>
      )}
    </li>
  );
}
