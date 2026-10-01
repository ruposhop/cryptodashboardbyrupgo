// Lo que cambia de una instalación a otra se configura con variables de
// entorno (ver README): así el mismo código sirve para cualquier dueño.
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Crypto Dashboard by Rupgo";

// Remitente de los emails. Sin dominio propio verificado en Resend, el de
// pruebas solo entrega al email con el que creaste tu cuenta de Resend.
export const EMAIL_FROM =
  process.env.EMAIL_FROM || `${APP_NAME} <onboarding@resend.dev>`;

// Enlace al código en la página de inicio. Por defecto, el repo original;
// quien quiera puede apuntar a su propio fork.
export const REPO_URL =
  process.env.NEXT_PUBLIC_REPO_URL || "https://github.com/ruposhop/cryptodashboardbyrupgo";
