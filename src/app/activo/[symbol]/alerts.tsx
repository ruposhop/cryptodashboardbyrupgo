"use client";

import { useActionState, useState } from "react";
import { currencySymbol, formatPrice, setCurrency } from "@/lib/format";
import { createAlert, deleteAlert, type AlertState } from "./alert-actions";

type Alert = {
  id: string;
  direction: "above" | "below";
  price_eur: number;
  note: string | null;
  active: boolean;
  triggered_at: string | null;
};

const day = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" });

export function Alerts({
  symbol,
  alerts,
  presets,
  currency,
}: {
  symbol: string;
  alerts: Alert[];
  presets: { label: string; price: number }[];
  currency: string;
}) {
  setCurrency(currency);
  const [state, action, pending] = useActionState<AlertState, FormData>(createAlert, null);
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");

  return (
    <div>
      {alerts.length > 0 && (
        <ul className="mb-4 divide-y divide-border rounded-xl border border-border">
          {alerts.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
              <div>
                <span className="font-mono tabular-nums">
                  {a.direction === "above" ? "≥" : "≤"} {formatPrice(Number(a.price_eur))}
                </span>
                {a.note && <span className="ml-2 text-muted">{a.note}</span>}
                <span className="ml-2 text-xs text-muted">
                  {a.active
                    ? "activa"
                    : a.triggered_at
                      ? `avisada el ${day.format(new Date(a.triggered_at))}`
                      : "inactiva"}
                </span>
              </div>
              <form action={deleteAlert}>
                <input type="hidden" name="id" value={a.id} />
                <input type="hidden" name="symbol" value={symbol} />
                <button type="submit" className="text-xs text-muted hover:text-foreground">
                  Quitar
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {presets.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => {
                setPrice(p.price.toFixed(p.price >= 1 ? 2 : 6));
                setNote(p.label);
              }}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted hover:text-foreground"
            >
              {p.label}: <span className="font-mono tabular-nums">{formatPrice(p.price)}</span>
            </button>
          ))}
        </div>
      )}

      <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <input type="hidden" name="symbol" value={symbol} />
        <input type="hidden" name="note" value={note} />
        <label className="flex flex-1 flex-col gap-1 text-xs text-muted">
          Avísame cuando {symbol} llegue a ({currencySymbol()})
          <input
            name="price"
            required
            inputMode="decimal"
            value={price}
            onChange={(e) => {
              setPrice(e.target.value);
              setNote("");
            }}
            placeholder="86450"
            className="h-10 rounded-lg border border-border bg-surface px-3 font-mono text-sm outline-none focus:border-foreground"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-lg bg-foreground px-4 text-sm font-medium text-background disabled:opacity-60"
        >
          {pending ? "Creando…" : "Crear alerta"}
        </button>
      </form>
      <p role="status" className={`mt-2 min-h-5 text-sm ${state?.error ? "text-loss" : "text-muted"}`}>
        {state?.message}
      </p>
    </div>
  );
}
