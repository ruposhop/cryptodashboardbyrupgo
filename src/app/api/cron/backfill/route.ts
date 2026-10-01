import { NextResponse } from "next/server";
import { isCronAuthorized, unauthorized } from "@/lib/cron";
import { backfillHistory } from "@/lib/history";

export const maxDuration = 300;

// Reconstruye el histórico. Se lanza a mano (y a diario desde la sincronización
// para los días que falten); es idempotente.
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) return unauthorized();

  try {
    return NextResponse.json(await backfillHistory());
  } catch (e) {
    console.error("backfill", e);
    return NextResponse.json({ error: "Reconstrucción fallida" }, { status: 502 });
  }
}
