import "server-only";
import { redirect } from "next/navigation";
import { isAllowedEmail } from "@/lib/auth";
import { loadCurrency } from "@/lib/currency";
import { createClient } from "@/lib/supabase/server";

// Comprobación propia en cada página y acción privada: no dependen solo del proxy.
export async function requireOwner() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAllowedEmail(user?.email)) redirect("/");
  // Deja lista la moneda de la instalación para formatear los importes.
  await loadCurrency();
  return user!;
}
