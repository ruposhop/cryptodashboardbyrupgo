"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatPrice } from "@/lib/format";

type Marker = { date: string; price: number; side: "in" | "out"; type: string };

const RANGES = [
  { key: "90d", days: 90 },
  { key: "1a", days: 365 },
  { key: "Todo", days: Infinity },
] as const;

const monthYear = new Intl.DateTimeFormat("es-ES", { month: "short", year: "2-digit" });
const longDate = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" });
const compact = new Intl.NumberFormat("es-ES", {
  maximumSignificantDigits: 3,
  notation: "compact",
});
const LABEL: Record<string, string> = {
  compra: "Compra",
  venta: "Venta",
  swap: "Swap",
  envio: "Envío",
  recepcion: "Recepción",
  ajuste: "Ajuste",
};

export function PriceChart({
  series,
  markers,
  breakEven,
}: {
  series: { date: string; price: number }[];
  markers: Marker[];
  breakEven: number | null;
}) {
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("Todo");

  const data = useMemo(() => {
    const days = RANGES.find((r) => r.key === range)!.days;
    const visible = Number.isFinite(days) ? series.slice(-days) : series;
    const start = visible[0]?.date ?? "";
    const byDate = new Map(visible.map((p) => [p.date, { ...p } as Record<string, unknown>]));
    for (const m of markers) {
      if (m.date < start) continue;
      const row = byDate.get(m.date) ?? { date: m.date };
      row[m.side === "in" ? "buy" : "sell"] = m.price;
      row[m.side === "in" ? "buyType" : "sellType"] = m.type;
      byDate.set(m.date, row);
    }
    const rows = [...byDate.values()].sort((a, b) =>
      String(a.date).localeCompare(String(b.date)),
    );
    // Las marcas van en series propias: así solo se pintan los días con operación.
    return {
      rows,
      buys: rows.filter((r) => r.buy != null),
      sells: rows.filter((r) => r.sell != null),
    };
  }, [series, markers, range]);

  if (series.length < 2) {
    return <p className="text-sm text-muted">Sin histórico de precio para este activo.</p>;
  }

  return (
    <div>
      <div className="flex justify-end">
        <div role="group" aria-label="Periodo" className="flex rounded-lg border border-border p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              aria-pressed={range === r.key}
              onClick={() => setRange(r.key)}
              className={`rounded-md px-2.5 py-1 text-xs ${
                range === r.key ? "bg-foreground text-background" : "text-muted hover:text-foreground"
              }`}
            >
              {r.key}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 h-56 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data.rows} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              minTickGap={40}
              tick={{ fill: "var(--muted)", fontSize: 11 }}
              tickFormatter={(d: string) => monthYear.format(new Date(d))}
            />
            <YAxis
              width={72}
              tickLine={false}
              axisLine={false}
              domain={["auto", "auto"]}
              tick={{ fill: "var(--muted)", fontSize: 11 }}
              tickFormatter={(v: number) => compact.format(v)}
            />
            <Tooltip
              cursor={{ stroke: "var(--muted)", strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as Record<string, number | string>;
                return (
                  <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-lg">
                    <p className="text-muted">{longDate.format(new Date(String(p.date)))}</p>
                    {p.price != null && (
                      <p className="mt-1 font-mono tabular-nums">{formatPrice(Number(p.price))}</p>
                    )}
                    {p.buy != null && (
                      <p className="font-mono tabular-nums">
                        ▲ {LABEL[String(p.buyType)] ?? "Entrada"} a {formatPrice(Number(p.buy))}
                      </p>
                    )}
                    {p.sell != null && (
                      <p className="font-mono tabular-nums">
                        ▼ {LABEL[String(p.sellType)] ?? "Salida"} a {formatPrice(Number(p.sell))}
                      </p>
                    )}
                  </div>
                );
              }}
            />
            {breakEven != null && breakEven > 0 && (
              <ReferenceLine
                y={breakEven}
                stroke="var(--muted)"
                strokeDasharray="4 4"
                label={{
                  value: "Equilibrio",
                  position: "insideTopLeft",
                  fill: "var(--muted)",
                  fontSize: 11,
                }}
              />
            )}
            <Line
              type="monotone"
              dataKey="price"
              stroke="var(--foreground)"
              strokeWidth={1.5}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
            <Scatter
              data={data.buys}
              dataKey="buy"
              fill="var(--foreground)"
              shape="triangle"
              isAnimationActive={false}
            />
            <Scatter
              data={data.sells}
              dataKey="sell"
              fill="var(--background)"
              stroke="var(--foreground)"
              shape="diamond"
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 flex flex-wrap gap-4 text-xs text-muted">
        <span>▲ Entradas (compras, swaps a este activo)</span>
        <span>◇ Salidas (ventas, swaps desde este activo)</span>
        {breakEven != null && breakEven > 0 && <span>- - Precio de equilibrio</span>}
      </p>
    </div>
  );
}
