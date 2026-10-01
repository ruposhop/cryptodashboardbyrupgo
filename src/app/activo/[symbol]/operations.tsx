"use client";

import { useState } from "react";
import { formatAmount, formatMoney, formatPrice, setCurrency } from "@/lib/format";

export type Operation = {
  id: string;
  occurredAt: string;
  type: string;
  amount: number;
  valueEur: number | null;
  unitPrice: number | null;
  origin: string;
  explorerUrl: string | null;
};

const LABEL: Record<string, string> = {
  compra: "Compra",
  venta: "Venta",
  swap: "Swap",
  envio: "Envío",
  recepcion: "Recepción",
  recompensa: "Recompensa",
  deposito: "Depósito",
  retiro: "Retiro",
  ajuste: "Ajuste",
  interno: "Interno",
};

const FILTERS = [
  { key: "todas", label: "Todas", match: () => true },
  {
    key: "operaciones",
    label: "Compras y ventas",
    match: (o: Operation) => ["compra", "venta", "swap"].includes(o.type),
  },
  { key: "recompensas", label: "Recompensas", match: (o: Operation) => o.type === "recompensa" },
  {
    key: "envios",
    label: "Envíos",
    match: (o: Operation) => ["envio", "recepcion"].includes(o.type),
  },
  { key: "internos", label: "Internos", match: (o: Operation) => o.type === "interno" },
] as const;

const PAGE = 50;
const dateTime = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Madrid",
});

// Todos los movimientos de una moneda, filtrables y paginados en el navegador.
export function Operations({
  operations,
  currency,
}: {
  operations: Operation[];
  currency: string;
}) {
  setCurrency(currency);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("todas");
  const [shown, setShown] = useState(PAGE);

  const match = FILTERS.find((f) => f.key === filter)!.match;
  const list = operations.filter(match);
  const counts = Object.fromEntries(
    FILTERS.map((f) => [f.key, operations.filter(f.match).length]),
  );

  return (
    <div>
      <div role="group" aria-label="Tipo" className="flex flex-wrap gap-2">
        {FILTERS.filter((f) => f.key === "todas" || counts[f.key] > 0).map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={filter === f.key}
            onClick={() => {
              setFilter(f.key);
              setShown(PAGE);
            }}
            className={`rounded-full border px-3 py-1 text-xs ${
              filter === f.key
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            {f.label} <span className="opacity-70">{counts[f.key]}</span>
          </button>
        ))}
      </div>

      <div className="mt-3 overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-3 font-normal">Fecha</th>
              <th className="px-4 py-3 font-normal">Tipo</th>
              <th className="px-4 py-3 text-right font-normal">Cantidad</th>
              <th className="hidden px-4 py-3 text-right font-normal sm:table-cell">Precio</th>
              <th className="px-4 py-3 text-right font-normal">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {list.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-muted">
                  Sin movimientos de este tipo.
                </td>
              </tr>
            )}
            {list.slice(0, shown).map((o) => (
              <tr key={o.id}>
                <td className="whitespace-nowrap px-4 py-3 text-muted">
                  {dateTime.format(new Date(o.occurredAt))}
                </td>
                <td className="px-4 py-3">
                  {LABEL[o.type] ?? o.type}
                  <span className="ml-2 hidden text-xs text-muted sm:inline">{o.origin}</span>
                  {o.explorerUrl && (
                    <a
                      href={o.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-xs text-muted underline underline-offset-2 hover:text-foreground"
                    >
                      tx
                    </a>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">
                  {o.amount > 0 ? "+" : ""}
                  {formatAmount(o.amount)}
                </td>
                <td className="hidden px-4 py-3 text-right font-mono tabular-nums sm:table-cell">
                  {o.unitPrice != null ? formatPrice(o.unitPrice) : "—"}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">
                  {o.valueEur != null ? formatMoney(o.valueEur) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {list.length > shown && (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE)}
          className="mt-3 w-full rounded-lg border border-border py-2 text-sm text-muted hover:text-foreground"
        >
          Ver {Math.min(PAGE, list.length - shown)} más ({list.length - shown} restantes)
        </button>
      )}
    </div>
  );
}
