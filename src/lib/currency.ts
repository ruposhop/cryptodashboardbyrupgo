import "server-only";
import { FIAT } from "@/lib/fifo";
import { DEFAULT_TIME_ZONE, isValidTimeZone, setCurrency, setTimeZone } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";

// Preferencias de la instalación: moneda y zona horaria.
//
// Moneda. Por orden:
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

// Lee la moneda y la zona horaria y las deja listas para formatear.
export async function loadCurrency() {
  const [code, zone] = await Promise.all([getCurrency(), getTimeZone()]);
  setCurrency(code);
  setTimeZone(zone);
  return code;
}

// Zona horaria: la elegida en Ajustes o Madrid.
const ZONE_KEY = "time_zone";
let cachedZone: string | null = null;

export async function getTimeZone() {
  if (cachedZone) return cachedZone;
  const { data } = await createAdminClient()
    .from("app_settings")
    .select("value")
    .eq("key", ZONE_KEY)
    .maybeSingle();
  cachedZone = data?.value && isValidTimeZone(data.value) ? data.value : null;
  return cachedZone ?? DEFAULT_TIME_ZONE;
}

export async function saveTimeZone(zone: string) {
  if (!isValidTimeZone(zone)) throw new Error("Zona horaria no válida");
  await createAdminClient().from("app_settings").upsert({ key: ZONE_KEY, value: zone });
  cachedZone = zone;
  setTimeZone(zone);
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
