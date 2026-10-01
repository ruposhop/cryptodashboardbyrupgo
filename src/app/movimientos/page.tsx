import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { formatAmount, formatDate, formatMoney } from "@/lib/format";
import {
  explorerUrl,
  listAssetSymbols,
  listMovements,
  PAGE_SIZE,
  TYPE_LABEL,
  type MovementFilters,
} from "@/lib/movements";
import { requireOwner } from "@/lib/session";

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function Movimientos({ searchParams }: PageProps<"/movimientos">) {
  await requireOwner();
  const sp = await searchParams;
  const filters: MovementFilters = {
    from: str(sp.desde),
    to: str(sp.hasta),
    asset: str(sp.activo),
    type: str(sp.tipo),
    origin: str(sp.origen) === "coinbase" || str(sp.origen) === "wallet"
      ? (str(sp.origen) as "coinbase" | "wallet")
      : undefined,
    internal: str(sp.internos) === "1",
    page: Number(str(sp.pagina)) || 1,
  };
  const [{ rows, total, page }, symbols] = await Promise.all([
    listMovements(filters),
    listAssetSymbols(),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && v) params.set(k, v);
    params.set("pagina", String(p));
    return `/movimientos?${params}`;
  };

  const field =
    "h-9 rounded-lg border border-border bg-surface px-2 text-sm outline-none focus:border-foreground";

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6 sm:px-8 sm:py-8">
      <AppHeader current="/movimientos" />

      <h1 className="mt-8 text-2xl font-semibold tracking-tight">Movimientos</h1>

      <form className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Desde
          <input type="date" name="desde" defaultValue={filters.from} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Hasta
          <input type="date" name="hasta" defaultValue={filters.to} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Activo
          <select name="activo" defaultValue={filters.asset ?? ""} className={field}>
            <option value="">Todos</option>
            {symbols.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Tipo
          <select name="tipo" defaultValue={filters.type ?? ""} className={field}>
            <option value="">Todos</option>
            {Object.entries(TYPE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Origen
          <select name="origen" defaultValue={filters.origin ?? ""} className={field}>
            <option value="">Todos</option>
            <option value="coinbase">Coinbase</option>
            <option value="wallet">Wallet</option>
          </select>
        </label>
        <label className="col-span-2 flex h-9 items-center gap-2 text-sm text-muted">
          <input type="checkbox" name="internos" value="1" defaultChecked={filters.internal} />
          Incluir internos
        </label>
        <div className="col-span-2 flex gap-2">
          <button type="submit" className="h-9 rounded-lg bg-foreground px-4 text-sm font-medium text-background">
            Filtrar
          </button>
          <Link href="/movimientos" className="h-9 rounded-lg border border-border px-3 text-sm leading-9 text-muted">
            Limpiar
          </Link>
        </div>
      </form>

      <p className="mt-6 text-xs text-muted">
        {total} movimientos{pages > 1 ? ` · página ${page} de ${pages}` : ""}
      </p>
      <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
        {rows.length === 0 && (
          <li className="px-4 py-6 text-sm text-muted">Ningún movimiento con esos filtros.</li>
        )}
        {rows.map((m) => {
          const url = explorerUrl(m.chain, m.txHash);
          return (
            <li key={m.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm">
                  {m.internal || m.type === "interno"
                    ? "Interno"
                    : (TYPE_LABEL[m.type] ?? m.type)}{" "}
                  <Link href={`/activo/${encodeURIComponent(m.symbol)}`} className="font-medium hover:underline">
                    {m.symbol}
                  </Link>
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

      {pages > 1 && (
        <nav aria-label="Páginas" className="mt-4 flex justify-between text-sm">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="text-muted hover:text-foreground">
              ← Anteriores
            </Link>
          ) : (
            <span />
          )}
          {page < pages && (
            <Link href={pageHref(page + 1)} className="text-muted hover:text-foreground">
              Siguientes →
            </Link>
          )}
        </nav>
      )}
    </main>
  );
}
