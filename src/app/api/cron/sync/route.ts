import { NextResponse } from "next/server";
import { isCronAuthorized, unauthorized } from "@/lib/cron";
import { syncAll } from "@/lib/sync";

export const maxDuration = 300;

// Vercel Cron la llama cada hora con Authorization: Bearer CRON_SECRET.
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) return unauthorized();

  const results = await syncAll();
  const ok = results.coinbase.ok && results.wallets.every((w) => w.ok);
  return NextResponse.json(results, { status: ok ? 200 : 502 });
}
