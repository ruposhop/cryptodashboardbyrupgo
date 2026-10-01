import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { bySymbol, getFiscalYears } from "@/lib/fiscal";
import {
  formatAmount,
  formatMoney,
  formatMoneySigned,
  pnlClass,
} from "@/lib/format";
import { requireOwner } from "@/lib/session";

const TYPE_LABEL: Record<string, string> = { venta: "Venta", swap: "Permuta" };
const day = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" });

export default async function Fiscal({ searchParams }: PageProps<"/fiscal">) {
  await requireOwner();
  const years = await getFiscalYears();
  const { year: yearParam } = await searchParams;
  const selected =
    years.find((y) => String(y.year) === yearParam) ??
    years.find((y) => y.year === new Date().getFullYear() - 1) ??
    years[0];

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6 sm:px-8 sm:py-8">
      <AppHeader current="/fiscal" />

      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Informe fiscal</h1>
          <p className="mt-1 text-sm text-muted">
            Ganancias y pérdidas patrimoniales por FIFO, por año natural.
          </p>
        </div>
        {selected && (
          <div className="flex gap-2 print:hidden">
            <a
              href={`/fiscal/csv?year=${selected.year}`}
              className="h-9 rounded-lg border border-border px-3 text-sm leading-9 hover:bg-surface"
            >
              Descargar CSV
            </a>
          </div>
        )}
      </div>

      {!selected ? (
        <p className="mt-8 text-sm text-muted">Todavía no hay operaciones.</p>
      ) : (
        <>
          <nav aria-label="Año" className="mt-6 flex flex-wrap gap-1 print:hidden">
            {years.map((y) => (
              <Link
                key={y.year}
                href={`/fiscal?year=${y.year}`}
                aria-current={y.year === selected.year ? "page" : undefined}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  y.year === selected.year
                    ? "bg-foreground text-background"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {y.year}
              </Link>
            ))}
          </nav>

          <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Ganancias">
              <span className={pnlClass(selected.gains)}>{formatMoneySigned(selected.gains)}</span>
            </Kpi>
            <Kpi label="Pérdidas">
              <span className={pnlClass(selected.losses)}>{formatMoneySigned(selected.losses)}</span>
            </Kpi>
            <Kpi label="Resultado neto">
              <span className={pnlClass(selected.net)}>{formatMoneySigned(selected.net)}</span>
            </Kpi>
            <Kpi label="Recompensas staking">
              {formatMoney(selected.rewardsEur)}
              <span className="block text-xs text-muted">{selected.rewardsCount} pagos</span>
            </Kpi>
          </dl>

          <div className="mt-4 space-y-1 text-xs leading-5 text-muted">
            <p>
              Incluye ventas y permutas (en muchos países, como España o EE. UU., cambiar
              una cripto por otra también tributa). Las recompensas de staking se muestran aparte, a su valor de
              mercado al recibirlas.
            </p>
            {selected.excludedSends > 0 && (
              <p>
                {selected.excludedSends} envíos a direcciones externas no se cuentan como
                venta: si alguno fue un pago o una donación, revísalo.
              </p>
            )}
            {selected.hasUnmatched && (
              <p>⚠ Hay operaciones sin compra registrada: su coste figura como 0.</p>
            )}
            <p>
              Criterio: las recompensas cuentan como rendimiento al valor de mercado del
              día en que las recibes, y ese valor es su coste cuando las vendes. Informe
              orientativo: valídalo con tu asesor antes de presentar la declaración.
            </p>
          </div>

          <section aria-labelledby="por-activo" className="mt-8">
            <h2 id="por-activo" className="text-sm uppercase tracking-wider text-muted">
              Por activo
            </h2>
            <div className="mt-3 overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-surface text-left text-xs text-muted">
                  <tr>
                    <th className="px-4 py-3 font-normal">Activo</th>
                    <th className="hidden px-4 py-3 text-right font-normal sm:table-cell">
                      Transmisión
                    </th>
                    <th className="hidden px-4 py-3 text-right font-normal sm:table-cell">
                      Adquisición
                    </th>
                    <th className="px-4 py-3 text-right font-normal">Resultado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {bySymbol(selected.disposals).map((s) => (
                    <tr key={s.symbol}>
                      <td className="px-4 py-3">
                        <span className="font-medium">{s.symbol}</span>
                        <span className="ml-2 text-xs text-muted">{s.count} op.</span>
                      </td>
                      <td className="hidden px-4 py-3 text-right font-mono tabular-nums sm:table-cell">
                        {formatMoney(s.proceeds)}
                      </td>
                      <td className="hidden px-4 py-3 text-right font-mono tabular-nums sm:table-cell">
                        {formatMoney(s.cost)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-mono tabular-nums ${pnlClass(s.proceeds - s.cost)}`}
                      >
                        {formatMoneySigned(s.proceeds - s.cost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section aria-labelledby="detalle" className="mt-8">
            <h2 id="detalle" className="text-sm uppercase tracking-wider text-muted">
              Operaciones ({selected.disposals.length})
            </h2>
            <div className="mt-3 overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-surface text-left text-xs text-muted">
                  <tr>
                    <th className="px-4 py-3 font-normal">Fecha</th>
                    <th className="px-4 py-3 font-normal">Activo</th>
                    <th className="hidden px-4 py-3 text-right font-normal sm:table-cell">
                      Cantidad
                    </th>
                    <th className="hidden px-4 py-3 text-right font-normal sm:table-cell">
                      Transmisión
                    </th>
                    <th className="hidden px-4 py-3 text-right font-normal sm:table-cell">
                      Adquisición
                    </th>
                    <th className="px-4 py-3 text-right font-normal">Resultado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {selected.disposals.map((d, i) => (
                    <tr key={i}>
                      <td className="whitespace-nowrap px-4 py-3 text-muted">
                        {day.format(new Date(d.occurredAt))}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium">{d.symbol}</span>
                        <span className="ml-2 text-xs text-muted">{TYPE_LABEL[d.type]}</span>
                      </td>
                      <td className="hidden px-4 py-3 text-right font-mono tabular-nums sm:table-cell">
                        {formatAmount(d.amount)}
                      </td>
                      <td className="hidden px-4 py-3 text-right font-mono tabular-nums sm:table-cell">
                        {formatMoney(d.proceedsEur)}
                      </td>
                      <td className="hidden px-4 py-3 text-right font-mono tabular-nums sm:table-cell">
                        {formatMoney(d.costEur)}
                        {d.unmatched && <span className="text-loss"> *</span>}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-mono tabular-nums ${pnlClass(d.proceedsEur - d.costEur)}`}
                      >
                        {formatMoneySigned(d.proceedsEur - d.costEur)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
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
