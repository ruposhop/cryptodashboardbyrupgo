import { NextResponse } from "next/server";
import { coinbaseGet } from "@/lib/coinbase";
import { isCronAuthorized, unauthorized } from "@/lib/cron";

type Accounts = {
  data: { currency: { code: string }; balance: { amount: string } }[];
};

// Comprueba que la key de Coinbase funciona. Nunca devuelve secretos ni saldos.
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) return unauthorized();

  try {
    const { data } = await coinbaseGet<Accounts>("/v2/accounts?limit=100");
    return NextResponse.json({
      coinbase: "ok",
      accounts: data.length,
      withBalance: data.filter((a) => Number(a.balance.amount) > 0).length,
    });
  } catch (e) {
    console.error("status", e);
    return NextResponse.json({ coinbase: "error" }, { status: 502 });
  }
}
