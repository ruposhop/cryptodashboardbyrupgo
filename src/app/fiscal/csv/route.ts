import { isAllowedEmail } from "@/lib/auth";
import { getCurrency } from "@/lib/currency";
import { getFiscalYears } from "@/lib/fiscal";
import { createClient } from "@/lib/supabase/server";

// CSV de las transmisiones de un año, para el gestor o la declaración.
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAllowedEmail(user?.email)) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const year = Number(new URL(request.url).searchParams.get("year"));
  const fy = (await getFiscalYears()).find((y) => y.year === year);
  if (!fy) return Response.json({ error: "Año sin datos" }, { status: 404 });

  // Formato español: separador ";" y coma decimal, para abrirlo en Excel.
  const num = (n: number, digits = 2) => n.toFixed(digits).replace(".", ",");
  const cur = (await getCurrency()).toLowerCase();
  const lines = [
    `fecha;activo;tipo;cantidad;valor_transmision_${cur};valor_adquisicion_${cur};resultado_${cur};coste_incompleto`,
    ...fy.disposals.map((d) =>
      [
        d.occurredAt.slice(0, 10),
        d.symbol,
        d.type,
        num(d.amount, 8),
        num(d.proceedsEur),
        num(d.costEur),
        num(d.proceedsEur - d.costEur),
        d.unmatched ? "si" : "no",
      ].join(";"),
    ),
  ];

  return new Response("﻿" + lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="crypto-fiscal-${year}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
