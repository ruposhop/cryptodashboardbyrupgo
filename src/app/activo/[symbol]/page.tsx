import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { getAssetDetail } from "@/lib/asset";
import {
  formatAmount,
  formatDate,
  formatMoney,
  formatMoneySigned,
  formatPct,
  formatPrice,
  getDisplayCurrency,
  pnlClass,
} from "@/lib/format";
import { explorerUrl } from "@/lib/movements";
import { requireOwner } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { Alerts } from "./alerts";
import { Operations } from "./operations";
import { PriceChart } from "./price-chart";

export default async function Activo({ params }: PageProps<"/activo/[symbol]">) {
  await requireOwner();
  const { symbol } = await params;
  const a = await getAssetDetail(decodeURIComponent(symbol));
  if (!a.position && a.trades.length === 0 && a.rewards.count === 0) notFound();

  const p = a.position;
  const supabase = await createClient();
  const { data: alerts } = await supabase
    .from("price_alerts")
    .select("id, direction, price_eur, note, active, triggered_at")
    .eq("symbol", a.symbol)
    .order("created_at", { ascending: false });

  // Atajos con los precios de la sección "Tu punto de equilibrio".
  const presets = [
    a.target && a.target.changeToBreakEven > 0
      ? { label: "Equilibrio", price: a.target.breakEvenEur }
      : null,
    a.target && a.target.uniformTargetEur > a.target.priceEur
      ? { label: "Cartera en positivo", price: a.target.uniformTargetEur }
      : null,
    a.target && a.target.soloChange > 0 && a.target.soloChange <= 5
      ? { label: "Solo con este activo", price: a.target.soloTargetEur }
      : null,
  ].filter((x): x is { label: string; price: number } => x != null);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6 sm:px-8 sm:py-8">
      <AppHeader current="/activo" />

      <Link href="/activo" className="mt-6 text-sm text-muted hover:text-foreground">
        ← Monedas
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        {a.symbol}
        {a.name && <span className="ml-2 text-base font-normal text-muted">{a.name}</span>}
      </h1>
      {p?.priceEur != null && (
        <p className="mt-1 font-mono text-3xl tabular-nums">{formatPrice(p.priceEur)}</p>
      )}

      {a.coin && (
        <section
          aria-labelledby="resultado"
          className="mt-6 rounded-xl border border-border bg-surface p-4 sm:p-5"
        >
          <h2 id="resultado" className="text-sm text-muted">
            Tu resultado total con {a.symbol}
          </h2>
          <p className={`mt-1 font-mono text-3xl tabular-nums ${pnlClass(a.coin.resultEur)}`}>
            {formatMoneySigned(a.coin.resultEur)}
          </p>
          <p className="mt-1 text-sm">
            {a.coin.resultEur >= 0 ? "Has ganado dinero" : "Has perdido dinero"} contando todas
            tus compras, ventas y cambios de {a.symbol}
            {a.coin.amount > 0 ? ", y lo que te queda a precio de hoy." : "."}
          </p>
          <dl className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
            <div className="flex justify-between gap-3 sm:block">
              <dt className="text-muted">Has metido</dt>
              <dd className="font-mono tabular-nums">{formatMoney(a.coin.inEur)}</dd>
            </div>
            <div className="flex justify-between gap-3 sm:block">
              <dt className="text-muted">Has sacado</dt>
              <dd className="font-mono tabular-nums">{formatMoney(a.coin.outEur)}</dd>
            </div>
            <div className="flex justify-between gap-3 sm:block">
              <dt className="text-muted">Lo que te queda vale</dt>
              <dd className="font-mono tabular-nums">{formatMoney(a.coin.valueEur)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs leading-5 text-muted">
            Resultado = sacado + lo que te queda − metido. «Metido» son compras y swaps hacia{" "}
            {a.symbol} (y lo que recibiste de fuera, a su valor de ese día); «sacado», ventas y
            swaps desde {a.symbol}. Los movimientos entre tu Coinbase y tu wallet no cuentan.
            {a.coin.rewardsEur > 0 &&
              ` Incluye ${formatMoney(a.coin.rewardsEur)} de recompensas, que no te costaron nada.`}
          </p>
        </section>
      )}

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Tienes">
          {p ? formatAmount(p.amount) : "0"}
          {p && <span className="block text-xs text-muted">{formatMoney(p.valueEur)}</span>}
        </Kpi>
        <Kpi label="Precio de equilibrio">
          {p?.breakEvenEur != null ? formatPrice(p.breakEvenEur) : "—"}
          {a.target && a.target.breakEvenEur > 0 && (() => {
            const distance = a.target.priceEur / a.target.breakEvenEur - 1;
            return (
              <span className={`block text-xs ${pnlClass(distance)}`}>
                {formatPct(distance)} {distance >= 0 ? "por encima" : "por debajo"}
              </span>
            );
          })()}
        </Kpi>
        <Kpi label="No realizado">
          {p ? (
            <span className={pnlClass(p.unrealizedEur)}>{formatMoneySigned(p.unrealizedEur)}</span>
          ) : (
            "—"
          )}
        </Kpi>
        <Kpi label="Realizado">
          {a.realizedEur != null ? (
            <span className={pnlClass(a.realizedEur)}>{formatMoneySigned(a.realizedEur)}</span>
          ) : (
            "—"
          )}
        </Kpi>
      </dl>

      {a.rewards.count > 0 && (
        <p className="mt-3 text-sm text-muted">
          Recompensas de staking: {a.rewards.count} pagos,{" "}
          <span className="font-mono tabular-nums">
            {formatAmount(a.rewards.amount)} {a.symbol}
          </span>{" "}
          (<span className="font-mono tabular-nums">{formatMoney(a.rewards.valueEur)}</span> al
          recibirlas).
        </p>
      )}

      <section aria-labelledby="precio" className="mt-8">
        <h2 id="precio" className="text-sm uppercase tracking-wider text-muted">
          Precio y operaciones
        </h2>
        <div className="mt-3 rounded-xl border border-border p-4 sm:p-5">
          <PriceChart
            series={a.series}
            markers={a.markers}
            breakEven={p?.breakEvenEur ?? null}
            currency={getDisplayCurrency()}
          />
        </div>
      </section>

      <section aria-labelledby="alertas" className="mt-8">
        <h2 id="alertas" className="text-sm uppercase tracking-wider text-muted">
          Alertas por email
        </h2>
        <div className="mt-3">
          <Alerts
            symbol={a.symbol}
            alerts={(alerts ?? []) as Parameters<typeof Alerts>[0]["alerts"]}
            presets={presets}
            currency={getDisplayCurrency()}
          />
        </div>
      </section>

      <section aria-labelledby="resumen-moneda" className="mt-8">
        <h2 id="resumen-moneda" className="text-sm uppercase tracking-wider text-muted">
          Tu historia con {a.symbol}
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Flow label="Comprado" flow={a.summary.bought} symbol={a.symbol} />
          <Flow label="Vendido o cambiado" flow={a.summary.sold} symbol={a.symbol} />
          <Flow label="Recibido de fuera" flow={a.summary.received} symbol={a.symbol} />
          <Flow label="Enviado fuera" flow={a.summary.sent} symbol={a.symbol} />
        </dl>
        {a.summary.firstAt && (
          <p className="mt-3 text-xs text-muted">
            {a.summary.total} movimientos desde el {formatDate(a.summary.firstAt)}. Los
            internos (entre tu Coinbase y tu wallet, o hacia el staking) no cambian lo que
            tienes.
          </p>
        )}
      </section>

      <section aria-labelledby="operaciones" className="mt-8">
        <h2 id="operaciones" className="text-sm uppercase tracking-wider text-muted">
          Todos los movimientos
        </h2>
        <div className="mt-3">
          <Operations
            currency={getDisplayCurrency()}
            operations={a.operations.map((o) => ({
              id: o.id,
              occurredAt: o.occurredAt,
              type: o.type,
              amount: o.amount,
              valueEur: o.valueEur,
              unitPrice: o.unitPrice,
              origin: o.origin,
              explorerUrl: explorerUrl(o.chain, o.txHash),
            }))}
          />
        </div>
      </section>
    </main>
  );
}

function Kpi({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 font-mono text-lg tabular-nums">{children}</dd>
    </div>
  );
}

function Flow({
  label,
  flow,
  symbol,
}: {
  label: string;
  flow: { count: number; amount: number; valueEur: number };
  symbol: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <dt className="text-xs text-muted">
        {label} <span className="opacity-70">· {flow.count}</span>
      </dt>
      <dd className="mt-1 font-mono tabular-nums">
        {flow.count ? formatMoney(flow.valueEur) : "—"}
        {flow.count > 0 && (
          <span className="block text-xs text-muted">
            {formatAmount(flow.amount)} {symbol}
          </span>
        )}
      </dd>
    </div>
  );
}
