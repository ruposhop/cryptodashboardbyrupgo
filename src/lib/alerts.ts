import "server-only";
import { emailButton, emailTemplate } from "@/lib/email-template";
import { formatAmount, formatEur, formatPrice } from "@/lib/format";
import { sendEmail } from "@/lib/resend";
import { createAdminClient } from "@/lib/supabase/admin";

// Alertas por email (MASTERPLAN §4): precio objetivo y movimientos en la wallet.

const SITE = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

// Precio actual en EUR de cualquier activo listado en Coinbase (endpoint público).
export async function currentPrices() {
  const res = await fetch("https://api.coinbase.com/v2/exchange-rates?currency=EUR", {
    cache: "no-store",
  });
  const { data } = (await res.json()) as { data: { rates: Record<string, string> } };
  const prices = new Map<string, number>();
  for (const [symbol, rate] of Object.entries(data.rates)) {
    if (Number(rate) > 0) prices.set(symbol, 1 / Number(rate));
  }
  return prices;
}

export async function checkPriceAlerts() {
  const db = createAdminClient();
  const { data: alerts } = await db
    .from("price_alerts")
    .select("id, symbol, direction, price_eur, note")
    .eq("active", true);
  if (!alerts?.length) return 0;

  const prices = await currentPrices();
  let sent = 0;
  for (const a of alerts) {
    const now = prices.get(a.symbol);
    if (now == null) continue;
    const target = Number(a.price_eur);
    const hit = a.direction === "above" ? now >= target : now <= target;
    if (!hit) continue;

    // Primero se desactiva: si el email falla no se repite cada hora.
    await db
      .from("price_alerts")
      .update({ active: false, triggered_at: new Date().toISOString(), triggered_price_eur: now })
      .eq("id", a.id);
    const verb = a.direction === "above" ? "ha superado" : "ha bajado de";
    await sendEmail(
      process.env.ALLOWED_EMAIL!,
      `${a.symbol} ${verb} ${formatPrice(target)}`,
      emailTemplate(
        `${a.symbol} ${verb} ${formatPrice(target)}`,
        `<p style="margin:0 0 12px;">Precio actual: <strong>${formatPrice(now)}</strong>.${
          a.note ? ` ${escapeHtml(a.note)}.` : ""
        }</p>${emailButton(`${SITE}/activo/${encodeURIComponent(a.symbol)}`, "Ver en el dashboard")}`,
      ),
    );
    sent++;
  }
  return sent;
}

type Fresh = {
  type: string;
  symbol: string;
  amount: number;
  valueEur: number | null;
  occurredAt: string;
};

const TYPE: Record<string, string> = {
  swap: "Swap",
  envio: "Envío",
  recepcion: "Recepción",
};

export async function notifyWalletMovements(fresh: Fresh[]) {
  if (fresh.length === 0) return;
  const rows = fresh
    .slice(0, 20)
    .map(
      (f) =>
        `<tr><td style="padding:4px 8px 4px 0;color:#8b919c;">${TYPE[f.type] ?? escapeHtml(f.type)}</td><td style="padding:4px 8px;">${escapeHtml(f.symbol)}</td><td style="padding:4px 0;text-align:right;font-family:ui-monospace,Menlo,monospace;">${f.amount > 0 ? "+" : ""}${formatAmount(f.amount)}${f.valueEur != null ? ` · ${formatEur(f.valueEur)}` : ""}</td></tr>`,
    )
    .join("");
  await sendEmail(
    process.env.ALLOWED_EMAIL!,
    `Nuevo movimiento en tu wallet (${fresh.length})`,
    emailTemplate(
      "Movimiento en tu wallet",
      `<p style="margin:0 0 12px;">Si no lo reconoces, revisa tu wallet cuanto antes.</p><table style="width:100%;font-size:13px;border-collapse:collapse;">${rows}</table>${emailButton(`${SITE}/movimientos?origen=wallet`, "Ver movimientos")}`,
    ),
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
