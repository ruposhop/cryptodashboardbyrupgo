"use client";

import { useMemo, useState } from "react";
import {
  Area,
  ComposedChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney, formatMoneySigned, pnlClass, setCurrency } from "@/lib/format";

export type Point = { date: string; value: number; invested: number };

const RANGES = [
  { key: "7d", label: "7d", days: 7 },
  { key: "30d", label: "30d", days: 30 },
  { key: "90d", label: "90d", days: 90 },
  { key: "1a", label: "1a", days: 365 },
  { key: "todo", label: "Todo", days: Infinity },
] as const;

const shortDate = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" });
const monthYear = new Intl.DateTimeFormat("es-ES", { month: "short", year: "2-digit" });
const longDate = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" });
const compact = new Intl.NumberFormat("es-ES", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function HistoryChart({ points, currency }: { points: Point[]; currency: string }) {
  setCurrency(currency);
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("1a");

  const data = useMemo(() => {
    const days = RANGES.find((r) => r.key === range)!.days;
    return Number.isFinite(days) ? points.slice(-days) : points;
  }, [points, range]);

  if (points.length < 2) {
    return <p className="text-sm text-muted">Aún no hay histórico suficiente.</p>;
  }

  const first = data[0];
  const last = data.at(-1)!;
  // Variación de la rentabilidad en el periodo: aísla lo que ha hecho el mercado de las
  // aportaciones nuevas.
  const change = last.value - last.invested - (first.value - first.invested);
  const longRange = data.length > 120;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Rentabilidad en el periodo:{" "}
          <span className={`font-mono tabular-nums ${pnlClass(change)}`}>
            {formatMoneySigned(change)}
          </span>
        </p>
        <div role="group" aria-label="Periodo" className="flex rounded-lg border border-border p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              aria-pressed={range === r.key}
              onClick={() => setRange(r.key)}
              className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                range === r.key ? "bg-foreground text-background" : "text-muted hover:text-foreground"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 h-56 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="valueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--foreground)" stopOpacity={0.18} />
                <stop offset="100%" stopColor="var(--foreground)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              minTickGap={40}
              tick={{ fill: "var(--muted)", fontSize: 11 }}
              tickFormatter={(d: string) =>
                (longRange ? monthYear : shortDate).format(new Date(d))
              }
            />
            <YAxis
              width={56}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted)", fontSize: 11 }}
              tickFormatter={(v: number) => compact.format(v)}
            />
            <Tooltip
              cursor={{ stroke: "var(--muted)", strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as Point;
                return (
                  <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-lg">
                    <p className="text-muted">{longDate.format(new Date(p.date))}</p>
                    <p className="mt-1 font-mono tabular-nums">Valor {formatMoney(p.value)}</p>
                    <p className="font-mono tabular-nums text-muted">
                      Metido {formatMoney(p.invested)}
                    </p>
                    <p className={`font-mono tabular-nums ${pnlClass(p.value - p.invested)}`}>
                      Rentabilidad {formatMoneySigned(p.value - p.invested)}
                    </p>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              name="Valor"
              stroke="var(--foreground)"
              strokeWidth={1.5}
              fill="url(#valueFill)"
              isAnimationActive={false}
            />
            <Line
              type="stepAfter"
              dataKey="invested"
              name="Aportado"
              stroke="var(--muted)"
              strokeWidth={1}
              strokeDasharray="4 4"
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 flex gap-4 text-xs text-muted">
        <span>
          <span className="mr-1.5 inline-block h-0.5 w-4 bg-foreground align-middle" />
          Valor
        </span>
        <span>
          <span className="mr-1.5 inline-block w-4 border-t border-dashed border-muted align-middle" />
          Dinero metido
        </span>
      </p>
    </div>
  );
}
