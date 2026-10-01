"use server";

import { revalidatePath } from "next/cache";
import { currentPrices } from "@/lib/alerts";
import { requireOwner } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export type AlertState = { message: string; error?: boolean } | null;

const SYMBOL = /^[A-Za-z0-9.$-]{1,20}$/;

// Acepta "86450", "86.450" o "86.450,50" (formato español).
function parsePrice(raw: string) {
  const s = raw.trim();
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/\.(?=\d{3}(\D|$))/g, "");
  return Number(normalized);
}

export async function createAlert(_prev: AlertState, formData: FormData): Promise<AlertState> {
  await requireOwner();
  const symbol = String(formData.get("symbol") ?? "");
  const price = parsePrice(String(formData.get("price") ?? ""));
  const note = String(formData.get("note") ?? "").slice(0, 80) || null;
  if (!SYMBOL.test(symbol) || !Number.isFinite(price) || price <= 0) {
    return { message: "Precio no válido.", error: true };
  }

  const now = (await currentPrices()).get(symbol);
  if (now == null) {
    return { message: `${symbol} no tiene precio en Coinbase: no se puede vigilar.`, error: true };
  }
  // La dirección sale sola: avisar cuando cruce el precio desde donde está hoy.
  const direction = price >= now ? "above" : "below";

  const { error } = await createAdminClient()
    .from("price_alerts")
    .insert({ symbol, direction, price_eur: price, note });
  if (error) return { message: "No se pudo crear la alerta.", error: true };

  revalidatePath(`/activo/${encodeURIComponent(symbol)}`);
  revalidatePath("/ajustes");
  return {
    message: `Te avisaré por email cuando ${symbol} ${direction === "above" ? "suba a" : "baje a"} ese precio (se comprueba cada hora).`,
  };
}

export async function deleteAlert(formData: FormData) {
  await requireOwner();
  const id = String(formData.get("id") ?? "");
  const symbol = String(formData.get("symbol") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id)) return;
  await createAdminClient().from("price_alerts").delete().eq("id", id);
  revalidatePath(`/activo/${encodeURIComponent(symbol)}`);
  revalidatePath("/ajustes");
}
