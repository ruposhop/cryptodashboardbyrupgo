import "server-only";
import { createClient } from "@supabase/supabase-js";

// Cliente con privilegios de admin (secret key). Solo servidor: se salta RLS.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
