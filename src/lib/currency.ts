import "server-only";
import { FIAT } from "@/lib/fifo";
import { setCurrency } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

// Moneda de la instalación. Por orden:
// 1. CURRENCY en las variables de entorno (EUR, USD…), si quieres forzarla.
// 2. La que se detectó de tu cuenta de Coinbase en la primera sincronización
//    (la moneda en la que Coinbase valora tus compras), guardada en app_settings.
// 3. EUR.
// Es fija: si cambia después, el historial ya guardado sigue en la anterior y
// hay que volver a sincronizarlo desde cero.

const KEY = "currency";
let cached: string | null = null;

export { FIAT };

// Stablecoins que valen 1 en esa moneda.
export const STABLE: Record<string, Set<string>> = {
  EUR: new Set(["EURC"]),
  USD: new Set(["USDC"]),
};

function fromEnv() {
  const env = process.env.CURRENCY?.trim().toUpperCase();
  return env && /^[A-Z]{3}$/.test(env) ? env : null;
}

export async function getCurrency() {
  const env = fromEnv();
  if (env) return env;
  if (cached) return cached;
  const { data } = await createAdminClient()
    .from("app_settings")
    .select("value")
    .eq("key", KEY)
    .maybeSingle();
  cached = data?.value ?? null;
  return cached ?? "EUR";
}

// Lee la moneda y la deja lista para formatear importes.
export async function loadCurrency() {
  const code = await getCurrency();
  setCurrency(code);
  return code;
}

// La primera vez que Coinbase dice en qué moneda valora tus movimientos, se
// guarda. Devuelve la moneda con la que hay que seguir.
export async function rememberDetectedCurrency(detected: string | null) {
  const current = fromEnv();
  if (current) return current;
  const db = createAdminClient();
  const { data } = await db.from("app_settings").select("value").eq("key", KEY).maybeSingle();
  if (data?.value) {
    cached = data.value;
    if (detected && detected !== data.value) {
      console.error(
        `Coinbase valora en ${detected} pero la instalación está en ${data.value}: revisa CURRENCY.`,
      );
    }
    return data.value;
  }
  const code = (detected ?? "EUR").toUpperCase();
  await db.from("app_settings").upsert({ key: KEY, value: code });
  cached = code;
  return code;
}
