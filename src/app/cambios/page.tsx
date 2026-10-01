import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import {
  formatAmount,
  formatEur,
  formatEurSigned,
  pnlClass,
} from "@/lib/format";
import { requireOwner } from "@/lib/session";
import { getStrategy } from "@/lib/strategy";

const day = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone: "Europe/Madrid" });

// ¿Me han salido bien los cambios entre monedas?
export default async function Cambios() {
  await requireOwner();
  const s = await getStrategy();
  const good = s.swaps.filter((w) => (w.verdict ?? 0) > 0).length;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6 sm:px-8 sm:py-8">
      <AppHeader current="/cambios" />
      <h1 className="mt-8 text-2xl font-semibold tracking-tight">Tus cambios entre monedas</h1>
      <p className="mt-1 text-sm text-muted">
        Cada vez que cambiaste una cripto por otra, comparado con lo que tendrías hoy si
        no lo hubieras hecho.
      </p>

      <section
        aria-labelledby="balance"
        className="mt-6 rounded-xl border border-border bg-surface p-4 sm:p-5"
      >
        <h2 id="balance" className="text-sm text-muted">
          Balance de todos tus cambios
        </h2>
        <p className={`mt-1 font-mono text-3xl tabular-nums ${pnlClass(s.swapsEffect)}`}>
          {formatEurSigned(s.swapsEffect)}
        </p>
        <p className="mt-1 text-sm">
          Hoy tu cartera vale <span className="font-mono tabular-nums">{formatEur(s.total)}</span>
          . Si hubieras hecho las mismas compras pero nunca hubieras cambiado nada, valdría{" "}
          <span className="font-mono tabular-nums">{formatEur(s.holdOnlyValue)}</span>.{" "}
          {s.swapsEffect >= 0
            ? "Tus cambios te han hecho ganar esa diferencia."
            : "Tus cambios te han hecho perder esa diferencia."}
        </p>
        <dl className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
          <div className="flex justify-between gap-3 sm:block">
            <dt className="text-muted">Cambios hechos</dt>
            <dd className="font-mono tabular-nums">{s.swaps.length}</dd>
          </div>
          <div className="flex justify-between gap-3 sm:block">
            <dt className="text-muted">Te salieron bien hasta hoy</dt>
            <dd className="font-mono tabular-nums">
              {good} de {s.swaps.length}
            </dd>
          </div>
          <div className="flex justify-between gap-3 sm:block">
            <dt className="text-muted">Comisiones y diferencia de precio</dt>
            <dd className="font-mono tabular-nums">{formatEur(s.swapCosts)}</dd>
          </div>
        </dl>
        {s.holdOnly.length > 0 && (
          <p className="mt-3 text-xs leading-5 text-muted">
            Sin cambios tendrías:{" "}
            {s.holdOnly
              .slice(0, 6)
              .map((h) => `${formatAmount(h.amount)} ${h.symbol} (${formatEur(h.valueEur)})`)
              .join(" · ")}
            {s.holdOnly.length > 6 ? "…" : ""}
          </p>
        )}
      </section>

      <section aria-labelledby="lista" className="mt-8">
        <h2 id="lista" className="text-sm uppercase tracking-wider text-muted">
          Uno a uno
        </h2>
        <p className="mt-1 text-xs text-muted">
          «Hoy» compara lo que vale ahora lo que recibiste con lo que valdría lo que diste.
          Cada cambio se mide por separado: si después volviste a cambiar lo recibido, esa
          segunda decisión aparece en su propia fila.
        </p>
        <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
          {s.swaps.map((w) => (
            <li key={w.key} className="px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="text-sm">
                  <Link href={`/activo/${encodeURIComponent(w.gave.symbol)}`} className="font-medium hover:underline">
                    {w.gave.symbol}
                  </Link>{" "}
                  →{" "}
                  <Link href={`/activo/${encodeURIComponent(w.got.symbol)}`} className="font-medium hover:underline">
                    {w.got.symbol}
                  </Link>
                  <span className="ml-2 text-xs text-muted">
                    {day.format(new Date(w.occurredAt))} · {w.origin}
                  </span>
                </p>
                {w.verdict != null && (
                  <p className={`font-mono text-sm tabular-nums ${pnlClass(w.verdict)}`}>
                    {formatEurSigned(w.verdict)} hoy
                  </p>
                )}
              </div>
              <p className="mt-1 text-xs text-muted">
                Diste <span className="font-mono tabular-nums">{formatAmount(w.gave.amount)} {w.gave.symbol}</span>{" "}
                ({formatEur(w.gave.valueThen)}) y recibiste{" "}
                <span className="font-mono tabular-nums">{formatAmount(w.got.amount)} {w.got.symbol}</span>{" "}
                ({formatEur(w.got.valueThen)}).
                {w.gave.valueToday != null && w.got.valueToday != null && (
                  <>
                    {" "}
                    Hoy: lo recibido vale{" "}
                    <span className="font-mono tabular-nums">{formatEur(w.got.valueToday)}</span>; lo que
                    diste valdría{" "}
                    <span className="font-mono tabular-nums">{formatEur(w.gave.valueToday)}</span>.
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
