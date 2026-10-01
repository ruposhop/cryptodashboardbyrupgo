import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Copia ALLOWED_EMAIL a la base de datos, donde las políticas RLS (is_owner)
// deciden quién puede leer. Así no hay ningún email escrito en el esquema.
export async function ensureOwner() {
  const email = process.env.ALLOWED_EMAIL?.trim().toLowerCase();
  if (!email) return;
  await createAdminClient()
    .from("app_settings")
    .upsert({ key: "owner_email", value: email });
}
