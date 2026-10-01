"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";

export type WalletState = { message: string; error?: boolean } | null;

const EVM = /^0x[0-9a-fA-F]{40}$/;
const SOLANA = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

// Solo direcciones públicas: la app nunca pide claves privadas ni frases semilla.
export async function addWallet(_prev: WalletState, formData: FormData): Promise<WalletState> {
  await requireOwner();
  const address = String(formData.get("address") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim().slice(0, 40) || "Wallet";

  const chain = EVM.test(address) ? "ethereum" : SOLANA.test(address) ? "solana" : null;
  if (!chain) {
    return {
      message: "No parece una dirección pública válida (0x… de 42 caracteres o Solana).",
      error: true,
    };
  }
  const normalized = chain === "ethereum" ? address.toLowerCase() : address;

  const db = createAdminClient();
  const { data: existing } = await db
    .from("sources")
    .select("id")
    .eq("type", "wallet")
    .ilike("address", normalized);
  if (existing?.length) {
    await db.from("sources").update({ active: true, label }).ilike("address", normalized);
  } else {
    const { error } = await db
      .from("sources")
      .insert({ type: "wallet", label, address: normalized, chain });
    if (error) return { message: "No se pudo guardar la dirección.", error: true };
  }

  revalidatePath("/ajustes");
  return {
    message:
      "Dirección guardada. Se leerá en la próxima sincronización de la wallet (cada 6 h o con «Sincronizar ahora»).",
  };
}

export async function setWalletActive(formData: FormData) {
  await requireOwner();
  const address = String(formData.get("address") ?? "");
  const active = formData.get("active") === "1";
  if (!address) return;
  // Desactivar no borra nada: deja de sincronizarse y su historial se conserva.
  await createAdminClient()
    .from("sources")
    .update({ active })
    .eq("type", "wallet")
    .ilike("address", address);
  revalidatePath("/ajustes");
}
