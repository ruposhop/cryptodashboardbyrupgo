import Link from "next/link";
import {
  formatAmount,
  formatDate,
  formatMoney,
  formatMoneySigned,
  formatPct,
  formatPrice,
  formatWeight,
  currencyName,
  getDisplayCurrency,
  pnlClass,
} from "@/lib/format";
import { explorerUrl, TYPE_LABEL } from "@/lib/movements";
import { getCosts } from "@/lib/costs";
import { getHistory, getPortfolio } from "@/lib/portfolio";
import { requireOwner } from "@/lib/session";
import { zerionCallsThisMonth } from "@/lib/sync";
import { AppHeader } from "@/components/app-header";
import { HistoryChart } from "./history-chart";

export default async function Dashboard() {
  await requireOwner();
  const [p, history, zerionCalls, costs] = await Promise.all([
    getPortfolio(),
    getHistory(),
    zerionCallsThisMonth(),
    getCosts(),
  ]);
  const parts = p.contributedParts;
  const pnlPct = p.contributed ? p.pnl / p.contributed : null;

  const syncWarning = p.syncFailing
    ? "La última sincronización falló: puede que falten datos recientes."
    : p.syncStale
      ? "Hace más de un día que no se sincroniza."
      : null;

  // Variación del mercado (MASTERPLAN §3.4): cambio del P&L desde hace N días,
  // así una compra nueva no cuenta como "subida".
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
  const variations = [
    { label: "24h", days: 1 },
    { label: "7d", days: 7 },
    { label: "30d", days: 30 },
  ].map(({ label, days }) => {
    const target = new Date(Date.parse(today) - days * 86400000).toISOString().slice(0, 10);
    const then = [...history].reverse().find((h) => h.date <= target);
    if (!then || !then.value) return { label, change: null, pct: null };
    const change = p.total - (p.invested ?? 0) - (then.value - then.invested);
    return { label, change, pct: change / then.value };
  });

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6 sm:px-8 sm:py-8">
      <AppHeader current="/dashboard" />

      <section aria-label="Resumen" className="mt-8">
        <p className="text-sm text-muted">Valor total</p>
        <p className="mt-1 font-mono text-4xl tabular-nums tracking-tight sm:text-5xl">
          {formatMoney(p.total)}
        </p>
        <ul aria-label="Variación" className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {variations.map((v) => (
            <li key={v.label} className="whitespace-nowrap">
              <span className="text-muted">{v.label}</span>{" "}
              {v.change == null ? (
                <span className="text-muted">—</span>
              ) : (
                <span className={`font-mono tabular-nums ${pnlClass(v.change)}`}>
                  {formatMoneySigned(v.change)} ({formatPct(v.pct!)})
                </span>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">
          Coinbase {formatMoney(p.byOrigin.Coinbase)} · Wallet {formatMoney(p.byOrigin.Wallet)}
          {" · "}
          {p.lastSync ? `Actualizado ${formatDate(p.lastSync)}` : "Sin sincronizar"}
        </p>
        {syncWarning && (
          <p role="status" className="mt-1 text-xs text-warn">
            {syncWarning} Detalle en{" "}
            <Link href="/ajustes" className="underline underline-offset-2">
              Ajustes
            </Link>
            .
          </p>
        )}
        <p className="mt-1 text-xs text-muted">
          Coinbase cada hora · Wallet cada 6 h · Zerion: {zerionCalls} / 2000
          peticiones este mes
        </p>

        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="Has metido">{formatMoney(p.contributed)}</Kpi>
          <Kpi label="Rentabilidad">
            <span className={pnlClass(p.pnl)}>{formatMoneySigned(p.pnl)}</span>
            {pnlPct != null && (
              <span className={`block text-sm sm:ml-2 sm:inline ${pnlClass(pnlPct)}`}>
                {formatPct(pnlPct)}
              </span>
            )}
          </Kpi>
          <Kpi label="Al año (TIR)">
            {p.irr != null ? (
              <span className={pnlClass(p.irr)}>{formatPct(p.irr)}</span>
            ) : (
              "—"
            )}
          </Kpi>
          <Kpi label="Recompensas staking">{formatMoney(p.rewards)}</Kpi>
        </dl>
        <p className="mt-3 text-xs leading-5 text-muted">
          Rentabilidad = lo que vale hoy − lo que has metido (compras con {currencyName()} y lo que
          entró de fuera de tus cuentas). Ya descuenta todas las comisiones
          (al comprar, al cambiar de moneda y de la red). «Al año» es la rentabilidad anual equivalente teniendo en cuenta cuándo
          hiciste cada aportación. El cálculo fiscal (FIFO) está en{" "}
          <Link href="/fiscal" className="underline underline-offset-2 hover:text-foreground">
            Fiscal
          </Link>
          .
        </p>
      </section>

      <section aria-labelledby="metido" className="mt-10">
        <h2 id="metido" className="text-sm uppercase tracking-wider text-muted">
          Dinero metido y comisiones
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border p-4 sm:p-5">
            <h3 className="text-sm font-medium">De dónde sale «Has metido»</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <Line
                label={`Compras con ${currencyName()} (${parts.compras.count})`}
                hint="lo que pagaste, comisión incluida"
                value={formatMoney(parts.compras.eur)}
              />
              {parts.entradas.count > 0 && (
                <Line
                  label={`Entradas de fuera (${parts.entradas.count})`}
                  hint="a su valor el día que llegaron"
                  value={formatMoney(parts.entradas.eur)}
                />
              )}
              {parts.ventas.count > 0 && (
                <Line
                  label={`Ventas a ${currencyName()} (${parts.ventas.count})`}
                  value={`−${formatMoney(parts.ventas.eur)}`}
                />
              )}
              {parts.salidas.count > 0 && (
                <Line
                  label={`Salidas fuera de tus cuentas (${parts.salidas.count})`}
                  value={`−${formatMoney(parts.salidas.eur)}`}
                />
              )}
              <Line label="Has metido" value={formatMoney(p.contributed)} total />
            </dl>
          </div>

          <div className="rounded-xl border border-border p-4 sm:p-5">
            <h3 className="text-sm font-medium">Lo que te han costado las comisiones</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <Line
                label={`Comisión de compra (${costs.buys})`}
                hint="la que declara Coinbase"
                value={formatMoney(costs.buyFees)}
              />
              {costs.buyMargin != null && (
                <Line
                  label="Margen en el precio de compra"
                  hint={`estimado con el cierre de cada día${costs.buyMarginCoverage < 0.99 ? `, sobre el ${formatWeight(costs.buyMarginCoverage)} de las compras` : ""}`}
                  value={`≈ ${formatMoney(costs.buyMargin)}`}
                />
              )}
              <Line
                label={`Cambios entre monedas (${costs.swaps})`}
                hint="comisión y diferencia de precio"
                value={formatMoney(costs.swapCosts)}
                href="/cambios"
              />
              {costs.gas >= 0.01 && (
                <Line label="Gas de la red (wallet)" value={formatMoney(costs.gas)} />
              )}
              <Line
                label="Total"
                hint={p.contributed ? `${formatWeight(costs.total / p.contributed)} de lo metido` : undefined}
                value={`≈ ${formatMoney(costs.total)}`}
                total
              />
            </dl>
          </div>
        </div>
        <p className="mt-3 text-xs leading-5 text-muted">
          Las comisiones ya están restadas en la rentabilidad: aquí solo se separan para
          ver cuánto se ha ido en costes y no en el mercado.
        </p>
      </section>

      <section aria-labelledby="evolucion" className="mt-10">
        <h2 id="evolucion" className="text-sm uppercase tracking-wider text-muted">
          Evolución
        </h2>
        <div className="mt-3 rounded-xl border border-border p-4 sm:p-5">
          <HistoryChart points={history} currency={getDisplayCurrency()} />
        </div>
        <p className="mt-2 text-xs text-muted">
          Días anteriores al 30/09/2026 reconstruidos con tus movimientos y los cierres
          diarios de Coinbase.
        </p>
      </section>

      <section aria-labelledby="equilibrio" className="mt-10">
        <h2 id="equilibrio" className="text-sm uppercase tracking-wider text-muted">
          Tu punto de equilibrio
        </h2>
        <div className="mt-3 rounded-xl border border-border bg-surface p-4 sm:p-5">
          <p className="text-sm text-muted">
            {p.pnl >= 0 ? "Estás por encima de lo que has metido" : "Estás por debajo de lo que has metido"}
          </p>
          <p className={`mt-1 font-mono text-2xl tabular-nums ${pnlClass(p.pnl)}`}>
            {formatMoneySigned(p.pnl)}
            {p.contributed > 0 && (
              <span className="ml-2 text-base">{formatPct(p.pnl / p.contributed)}</span>
            )}
          </p>
          <BreakEvenBar value={p.total} invested={p.contributed} />
          <p className="mt-3 text-sm leading-6">
            {p.pnl >= 0 ? (
              <>
                Tu cartera podría bajar un{" "}
                <span className="font-mono tabular-nums">
                  {formatWeight(p.total ? p.pnl / p.total : 0)}
                </span>{" "}
                y seguirías sin perder dinero.
              </>
            ) : (
              <>
                Si toda la cartera sube un{" "}
                <span className="font-mono tabular-nums">{formatWeight(p.uniformRise)}</span>,
                vuelves a tu punto de equilibrio.
              </>
            )}
          </p>
          {Math.abs(p.pnl - p.unrealized) >= 1 && (
            <p className="mt-2 text-xs leading-5 text-muted">
              Lo que tienes ahora va{" "}
              <span className={`font-mono tabular-nums ${pnlClass(p.unrealized)}`}>
                {formatMoneySigned(p.unrealized)}
              </span>{" "}
              sobre lo que te costó. El resto (
              <span className={`font-mono tabular-nums ${pnlClass(p.pnl - p.unrealized)}`}>
                {formatMoneySigned(p.pnl - p.unrealized)}
              </span>
              ) viene de monedas que ya no tienes, de cambios entre monedas y de comisiones.
            </p>
          )}
        </div>

        <div className="mt-3 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-3 font-normal">Activo</th>
                <th className="hidden px-4 py-3 text-right font-normal sm:table-cell">Precio hoy</th>
                <th className="px-4 py-3 text-right font-normal">Equilibrio</th>
                <th className="px-4 py-3 text-right font-normal">Vs. equilibrio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {p.targets.map((t) => {
                // Sin coste (todo recibido gratis): no hay distancia que medir.
                const distance = t.breakEvenEur > 0 ? t.priceEur / t.breakEvenEur - 1 : null;
                const pos = p.positions.find((x) => x.symbol === t.symbol);
                return (
                  <tr key={t.symbol}>
                    <td className="px-4 py-3">
                      <Link
                        href={`/activo/${encodeURIComponent(t.symbol)}`}
                        className="font-medium hover:underline"
                      >
                        {t.symbol}
                      </Link>
                    </td>
                    <td className="hidden px-4 py-3 text-right font-mono tabular-nums sm:table-cell">
                      {formatPrice(t.priceEur)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {formatPrice(t.breakEvenEur)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono tabular-nums ${distance != null ? pnlClass(distance) : ""}`}
                    >
                      {distance == null ? (
                        <span className="text-muted">sin coste</span>
                      ) : (
                        <span className="whitespace-nowrap">
                          {formatPct(distance)}
                          <span className="hidden sm:inline">
                            {distance >= 0 ? " por encima" : " por debajo"}
                          </span>
                        </span>
                      )}
                      {pos && (
                        <span className="block text-xs">{formatMoneySigned(pos.unrealizedEur)}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs leading-5 text-muted">
          <strong className="font-medium text-foreground">Equilibrio</strong>: el precio al
          que esa moneda ni gana ni pierde respecto a lo que pagaste por ella (coste FIFO ÷
          cantidad). Por encima ganas y por debajo pierdes. Son cálculos sobre tus datos, no
          recomendaciones de inversión.
        </p>
        {p.warnings.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-muted">
            {p.warnings.map((w) => (
              <li key={w.symbol}>
                ⚠ {w.symbol}:{" "}
                {w.orphanCostEur >= 5
                  ? `el historial registra unidades que ya no están en tu saldo; su coste (${formatMoney(w.orphanCostEur)}) cuenta como pérdida realizada.`
                  : w.unmatchedEur >= 5
                    ? `ventas por ${formatMoney(w.unmatchedEur)} sin compra registrada; cuentan como beneficio.`
                    : `solo el ${formatWeight(w.coverage)} del saldo tiene historial; el resto cuenta a coste 0.`}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="reparto" className="mt-8">
        <h2 id="reparto" className="sr-only">
          Reparto
        </h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <Allocation
            title="Por activo"
            items={p.positions.map((pos) => ({ label: pos.symbol, value: pos.valueEur }))}
            total={p.total}
          />
          <Allocation title="Dónde está" items={p.byLocation} total={p.total} />
        </div>
      </section>

      <section aria-labelledby="posiciones" className="mt-10">
        <h2 id="posiciones" className="text-sm uppercase tracking-wider text-muted">
          Posiciones
        </h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-3 font-normal">Activo</th>
                <th className="px-4 py-3 text-right font-normal">Cantidad</th>
                <th className="hidden px-4 py-3 text-right font-normal sm:table-cell">Precio</th>
                <th className="hidden px-4 py-3 text-right font-normal sm:table-cell">Coste medio</th>
                <th className="px-4 py-3 text-right font-normal">Valor</th>
                <th className="px-4 py-3 text-right font-normal">P&L</th>
                <th className="hidden px-4 py-3 text-right font-normal sm:table-cell">Peso</th>
                <th className="hidden px-4 py-3 font-normal sm:table-cell">Origen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {p.positions.map((pos) => (
                <tr key={pos.symbol}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/activo/${encodeURIComponent(pos.symbol)}`}
                      className="font-medium hover:underline"
                    >
                      {pos.symbol}
                    </Link>
                    {pos.name && <span className="ml-2 hidden text-muted sm:inline">{pos.name}</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {formatAmount(pos.amount)}
                  </td>
                  <td className="hidden px-4 py-3 text-right font-mono tabular-nums sm:table-cell">
                    {pos.priceEur != null ? formatPrice(pos.priceEur) : "—"}
                  </td>
                  <td className="hidden px-4 py-3 text-right font-mono tabular-nums sm:table-cell">
                    {pos.breakEvenEur != null ? formatPrice(pos.breakEvenEur) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {formatMoney(pos.valueEur)}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono tabular-nums ${pnlClass(pos.unrealizedEur)}`}>
                    {formatMoneySigned(pos.unrealizedEur)}
                    {pos.costEur > 0 && (
                      <span className="block text-xs">
                        {formatPct(pos.unrealizedEur / pos.costEur)}
                      </span>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-right font-mono tabular-nums text-muted sm:table-cell">
                    {formatWeight(pos.weight)}
                  </td>
                  <td className="hidden px-4 py-3 text-muted sm:table-cell">{pos.origins.join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="movimientos" className="mt-10">
        <div className="flex items-baseline justify-between">
          <h2 id="movimientos" className="text-sm uppercase tracking-wider text-muted">
            Últimos movimientos
          </h2>
          <Link href="/movimientos" className="text-sm text-muted hover:text-foreground">
            Ver todos →
          </Link>
        </div>
        <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
          {p.movements.map((m) => {
            const url = explorerUrl(m.chain, m.txHash);
            return (
              <li key={m.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm">
                    {TYPE_LABEL[m.type] ?? m.type}{" "}
                    <span className="font-medium">{m.symbol}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {formatDate(m.occurredAt)} · {m.origin}
                    {m.chain && m.origin === "Wallet" ? ` · ${m.chain}` : ""}
                    {url && (
                      <>
                        {" · "}
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline underline-offset-2 hover:text-foreground"
                        >
                          ver tx
                        </a>
                      </>
                    )}
                  </p>
                </div>
                <div className="shrink-0 text-right font-mono text-sm tabular-nums">
                  <p>
                    {m.amount > 0 ? "+" : ""}
                    {formatAmount(m.amount)}
                  </p>
                  <p className="text-xs text-muted">
                    {m.valueEur != null ? formatMoney(m.valueEur) : "—"}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}

// Lo que vale hoy frente a lo que has metido: la marca es tu punto de equilibrio.
function BreakEvenBar({ value, invested }: { value: number; invested: number }) {
  const max = Math.max(value, invested) || 1;
  return (
    <div className="mt-4">
      <div className="relative h-2 rounded-full bg-border">
        <div
          className={`absolute inset-y-0 left-0 rounded-full ${value >= invested ? "bg-gain" : "bg-loss"}`}
          style={{ width: `${(value / max) * 100}%` }}
        />
        <div
          className="absolute -inset-y-1 w-0.5 bg-foreground"
          style={{ left: `calc(${(invested / max) * 100}% - 1px)` }}
          aria-hidden
        />
      </div>
      <div className="mt-2 flex justify-between gap-4 text-xs text-muted">
        <span>
          Vale hoy <span className="font-mono tabular-nums text-foreground">{formatMoney(value)}</span>
        </span>
        <span>
          Has metido{" "}
          <span className="font-mono tabular-nums text-foreground">{formatMoney(invested)}</span>
        </span>
      </div>
    </div>
  );
}

function Line({
  label,
  hint,
  value,
  href,
  total,
}: {
  label: string;
  hint?: string;
  value: string;
  href?: string;
  total?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 ${total ? "border-t border-border pt-2 font-medium" : ""}`}
    >
      <dt className="min-w-0">
        {href ? (
          <Link href={href} className="underline-offset-2 hover:underline">
            {label}
          </Link>
        ) : (
          label
        )}
        {hint && <span className="block text-xs font-normal text-muted">{hint}</span>}
      </dt>
      <dd className="shrink-0 font-mono tabular-nums">{value}</dd>
    </div>
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

// Barra de reparto: las 5 partes mayores y el resto agrupado en "Otros".
function Allocation({
  title,
  items,
  total,
}: {
  title: string;
  items: { label: string; value: number }[];
  total: number;
}) {
  const top = items.slice(0, 5);
  const rest = items.slice(5).reduce((s, i) => s + i.value, 0);
  const parts = rest > 0 ? [...top, { label: "Otros", value: rest }] : top;
  return (
    <div>
      <p className="text-xs text-muted">{title}</p>
      <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-surface">
        {parts.map((part, i) => (
          <div
            key={part.label}
            style={{
              width: `${total ? (part.value / total) * 100 : 0}%`,
              opacity: 1 - i * 0.15,
            }}
            className="bg-foreground"
            title={`${part.label} ${formatWeight(total ? part.value / total : 0)}`}
          />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {parts.map((part) => (
          <li key={part.label}>
            <span className="text-foreground">{part.label}</span>{" "}
            {formatWeight(total ? part.value / total : 0)}
          </li>
        ))}
      </ul>
    </div>
  );
}
