import type { VercelConfig } from "@vercel/config/v1";

// Configuración de Vercel (se evalúa al desplegar). La frecuencia de la
// sincronización sale de SYNC_CRON: por defecto una vez al día, lo único que
// permite el plan gratuito (Hobby). En Pro puedes poner "0 * * * *" (cada hora).
export const crons: VercelConfig["crons"] = [
  { path: "/api/cron/sync", schedule: process.env.SYNC_CRON || "0 6 * * *" },
];
