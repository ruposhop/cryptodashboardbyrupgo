import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import {
  formatAmount,
  formatEur,
  formatEurSigned,
  formatPrice,
  pnlClass,
} from "@/lib/format";
import { getPortfolio } from "@/lib/portfolio";
import { requireOwner } from "@/lib/session";

// Todas las monedas con las que has operado: las que tienes y las que ya no.
export default async function Monedas() {
  await requireOwner();
  const p = await getPortfolio();

  const held = p.assets
    .filter((a) => a.valueEur >= 0.01)
    .sort((a, b) => b.valueEur - a.valueEur);
  const past = p.assets
    .filter((a) => a.valueEur < 0.01 && Math.abs(a.resultEur) >= 0.01)
    .sort((a, b) => a.resultEur - b.resultEur);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6 sm:px-8 sm:py-8">
      <AppHeader current="/activo" />
      <h1 className="mt-8 text-2xl font-semibold tracking-tight">Monedas</h1>
      <p className="mt-1 text-sm text-muted">
        Resultado total de cada moneda: lo que sacaste + lo que vale lo que te queda −
        lo que metiste. Pulsa una para ver el detalle y todos sus movimientos.
      </p>

      <section aria-labelledby="tienes" className="mt-6">
        <h2 id="tienes" className="text-sm uppercase tracking-wider text-muted">
          Las que tienes ({held.length})
        </h2>
        <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
          {held.map((a) => (
            <li key={a.symbol}>
              <Link
                href={`/activo/${encodeURIComponent(a.symbol)}`}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-surface"
              >
                <div className="min-w-0">
                  <p className="font-medium">{a.symbol}</p>
                  <p className="text-xs text-muted">
                    <span className="font-mono tabular-nums">{formatAmount(a.amount)}</span>
                    {a.priceEur != null && (
                      <>
                        {" · "}
                        <span className="font-mono tabular-nums">{formatPrice(a.priceEur)}</span>
                      </>
                    )}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono tabular-nums">{formatEur(a.valueEur)}</p>
                  <p className={`font-mono text-xs tabular-nums ${pnlClass(a.resultEur)}`}>
                    {formatEurSigned(a.resultEur)} en total
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {past.length > 0 && (
        <section aria-labelledby="pasadas" className="mt-8">
          <h2 id="pasadas" className="text-sm uppercase tracking-wider text-muted">
            Las que ya no tienes ({past.length})
          </h2>
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
            {past.map((a) => (
              <li key={a.symbol}>
                <Link
                  href={`/activo/${encodeURIComponent(a.symbol)}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-surface"
                >
                  <p className="font-medium">{a.symbol}</p>
                  <div className="text-right">
                    <p className={`font-mono tabular-nums ${pnlClass(a.resultEur)}`}>
                      {formatEurSigned(a.resultEur)}
                    </p>
                    <p className="text-xs text-muted">resultado total</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
