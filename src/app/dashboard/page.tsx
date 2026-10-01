import Link from "next/link";
import {
  formatAmount,
  formatDate,
  formatEur,
  formatEurSigned,
  formatPct,
  formatPrice,
  formatWeight,
  pnlClass,
} from "@/lib/format";
import { explorerUrl, TYPE_LABEL } from "@/lib/movements";
import { getHistory, getPortfolio } from "@/lib/portfolio";
import { requireOwner } from "@/lib/session";
import { zerionCallsThisMonth } from "@/lib/sync";
import { AppHeader } from "@/components/app-header";
import { HistoryChart } from "./history-chart";

export default async function Dashboard() {
  await requireOwner();
  const [p, history, zerionCalls] = await Promise.all([
    getPortfolio(),
    getHistory(),
    zerionCallsThisMonth(),
  ]);
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
          {formatEur(p.total)}
        </p>
        <ul aria-label="Variación" className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {variations.map((v) => (
            <li key={v.label} className="whitespace-nowrap">
              <span className="text-muted">{v.label}</span>{" "}
              {v.change == null ? (
                <span className="text-muted">—</span>
              ) : (
                <span className={`font-mono tabular-nums ${pnlClass(v.change)}`}>
                  {formatEurSigned(v.change)} ({formatPct(v.pct!)})
                </span>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">
          Coinbase {formatEur(p.byOrigin.Coinbase)} · Wallet {formatEur(p.byOrigin.Wallet)}
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
          <Kpi label="Has metido">{formatEur(p.contributed)}</Kpi>
          <Kpi label="Rentabilidad">
            <span className={pnlClass(p.pnl)}>{formatEurSigned(p.pnl)}</span>
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
          <Kpi label="Recompensas staking">{formatEur(p.rewards)}</Kpi>
        </dl>
        <p className="mt-3 text-xs leading-5 text-muted">
          Rentabilidad = lo que vale hoy − lo que has metido (compras con euros y lo que
          entró de fuera de tus cuentas). Ya descuenta las comisiones de tus
          cambios. «Al año» es la rentabilidad anual equivalente teniendo en cuenta cuándo
          entró cada euro. El cálculo fiscal (FIFO) está en{" "}
          <Link href="/fiscal" className="underline underline-offset-2 hover:text-foreground">
            Fiscal
          </Link>
          .
        </p>
      </section>

      <section aria-labelledby="evolucion" className="mt-10">
        <h2 id="evolucion" className="text-sm uppercase tracking-wider text-muted">
          Evolución
        </h2>
        <div className="mt-3 rounded-xl border border-border p-4 sm:p-5">
          <HistoryChart points={history} />
        </div>
        <p className="mt-2 text-xs text-muted">
          Días anteriores al 30/09/2026 reconstruidos con tus movimientos y los cierres
          diarios de Coinbase.
        </p>
      </section>

      <section aria-labelledby="positivo" className="mt-10">
        <h2 id="positivo" className="text-sm uppercase tracking-wider text-muted">
          Para estar en positivo
        </h2>
        <div className="mt-3 rounded-xl border border-border bg-surface p-4 sm:p-5">
          {p.deficit > 0 ? (
            <>
              <p className="text-sm leading-6">
                Te faltan{" "}
                <span className="font-mono tabular-nums text-loss">
                  {formatEur(p.deficit)}
                </span>{" "}
                para que tu fondo vuelva a valer lo que has metido. Si toda la cartera sube por igual,
                necesita subir un{" "}
                <span className="font-mono tabular-nums">
                  {formatPct(p.uniformRise)}
                </span>
                .
              </p>
              <p className="mt-2 text-xs text-muted">
                Solo cuenta lo que tienes hoy: lo que se perdió al cambiar de moneda (por
                ejemplo ADA) ya no se recupera si esa moneda sube, porque ya no la tienes.
              </p>
            </>
          ) : (
            <p className="text-sm leading-6">
              Tu fondo ya vale más de lo que has metido:{" "}
              <span className="font-mono tabular-nums text-gain">
                {formatEurSigned(p.pnl)}
              </span>
              .
            </p>
          )}
        </div>

        <div className="mt-3 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-3 font-normal">Activo</th>
                <th className="px-4 py-3 text-right font-normal">Precio hoy</th>
                <th className="px-4 py-3 text-right font-normal">Equilibrio</th>
                {p.deficit > 0 && (
                  <>
                    <th className="hidden px-4 py-3 text-right font-normal sm:table-cell">
                      Si todo sube igual
                    </th>
                    <th className="hidden px-4 py-3 text-right font-normal sm:table-cell">
                      Si solo sube este
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {p.targets.map((t) => (
                <tr key={t.symbol}>
                  <td className="px-4 py-3 font-medium">{t.symbol}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {formatPrice(t.priceEur)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {formatPrice(t.breakEvenEur)}
                    <span
                      className={`block whitespace-nowrap text-xs ${t.changeToBreakEven > 0 ? "text-loss" : "text-gain"}`}
                    >
                      {t.changeToBreakEven > 0
                        ? `${formatPct(t.changeToBreakEven)} para llegar`
                        : "ya en positivo"}
                    </span>
                  </td>
                  {p.deficit > 0 && (
                    <>
                      <td className="hidden px-4 py-3 text-right font-mono tabular-nums sm:table-cell">
                        {formatPrice(t.uniformTargetEur)}
                      </td>
                      <td className="hidden px-4 py-3 text-right font-mono tabular-nums sm:table-cell">
                        {t.soloChange > 5 ? (
                          // Posición demasiado pequeña: el precio necesario no es realista.
                          <span className="text-muted">—</span>
                        ) : (
                          <>
                            {formatPrice(t.soloTargetEur)}
                            <span className="block text-xs text-muted">
                              {formatPct(t.soloChange)}
                            </span>
                          </>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs leading-5 text-muted">
          <strong className="font-medium text-foreground">Equilibrio</strong>: precio al
          que esa posición ni gana ni pierde (coste FIFO ÷ cantidad).{" "}
          {p.deficit > 0 && (
            <>
              <strong className="font-medium text-foreground">Si todo sube igual</strong>:
              precio de cada activo cuando la cartera entera vuelve a valer lo que has metido.{" "}
              <strong className="font-medium text-foreground">Si solo sube este</strong>:
              precio que tendría que alcanzar ese activo, con el resto quieto, para
              recuperarlo él solo.{" "}
            </>
          )}
          Son cálculos sobre tus datos, no recomendaciones de inversión.
        </p>
        {p.warnings.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-muted">
            {p.warnings.map((w) => (
              <li key={w.symbol}>
                ⚠ {w.symbol}:{" "}
                {w.orphanCostEur >= 5
                  ? `el historial registra unidades que ya no están en tu saldo; su coste (${formatEur(w.orphanCostEur)}) cuenta como pérdida realizada.`
                  : w.unmatchedEur >= 5
                    ? `ventas por ${formatEur(w.unmatchedEur)} sin compra registrada; cuentan como beneficio.`
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
                    {formatEur(pos.valueEur)}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono tabular-nums ${pnlClass(pos.unrealizedEur)}`}>
                    {formatEurSigned(pos.unrealizedEur)}
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
                    {m.valueEur != null ? formatEur(m.valueEur) : "—"}
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
