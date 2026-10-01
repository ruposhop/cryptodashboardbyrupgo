"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isAllowedEmail } from "@/lib/auth";
import { requireOwner } from "@/lib/session";
import { emailButton, emailTemplate } from "@/lib/email-template";
import { sendEmail } from "@/lib/resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncAll } from "@/lib/sync";
import { createClient } from "@/lib/supabase/server";
import { ensureOwner } from "@/lib/owner";

export type LoginState = {
  message: string;
  error?: boolean;
  email?: string; // para el paso del código, si se ha pedido
} | null;

// El origen del enlace sale de la configuración de Vercel, nunca de las
// cabeceras de la petición (evita enlaces envenenados por Host falso). Solo
// producción y local: las previews no son una puerta de entrada.
async function siteOrigin() {
  if (process.env.VERCEL_ENV === "production") {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_ENV) throw new Error("Login solo en producción");
  const host = (await headers()).get("host") ?? "";
  if (!/^localhost:\d+$/.test(host)) throw new Error("Host no permitido");
  return `http://${host}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Como mucho un enlace por minuto y 10 al día: evita llenar el buzón, gastar
// Resend y que cada envío invalide el enlace anterior.
async function canSendLink() {
  const admin = createAdminClient();
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data } = await admin
    .from("magic_link_sends")
    .select("sent_at")
    .gte("sent_at", dayAgo)
    .order("sent_at", { ascending: false });
  const sends = data ?? [];
  const last = sends[0] ? new Date(sends[0].sent_at).getTime() : 0;
  if (sends.length >= 10 || Date.now() - last < 60 * 1000) return false;
  await admin.from("magic_link_sends").insert({});
  return true;
}

async function generateTokenHash(email: string) {
  const admin = createAdminClient();
  const generate = () =>
    admin.auth.admin.generateLink({ type: "magiclink", email });

  let { data, error } = await generate();
  if (error) {
    // Primera vez: el usuario todavía no existe en Supabase Auth.
    await admin.auth.admin.createUser({ email, email_confirm: true });
    ({ data, error } = await generate());
  }
  if (error || !data.properties) throw error ?? new Error("Sin enlace");
  // El mismo envío trae enlace y código numérico: el código sirve para
  // entrar desde la app instalada en el móvil, que no comparte sesión con Safari.
  return { tokenHash: data.properties.hashed_token, code: data.properties.email_otp };
}

export async function sendMagicLink(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  // Misma respuesta, y tiempo parecido, para cualquier email y cualquier
  // resultado: no se revela cuál tiene acceso. Los fallos quedan en los logs.
  const sent = {
    message: "Si ese email tiene acceso, recibirás un enlace y un código en tu correo.",
    email,
  };

  if (!isAllowedEmail(email)) {
    await sleep(800 + Math.random() * 400);
    return sent;
  }

  try {
    await ensureOwner();
    if (!(await canSendLink())) return sent;
    const origin = await siteOrigin();
    const { tokenHash, code } = await generateTokenHash(email);
    const link = `${origin}/auth/confirm?token_hash=${tokenHash}`;

    await sendEmail(
      email,
      `Tu código de acceso: ${code}`,
      emailTemplate(
        "Entra en tu dashboard",
        `<p style="margin:0 0 12px;">Pulsa el botón para iniciar sesión, o escribe este código en la pantalla de acceso:</p><p style="margin:0 0 16px;font-family:ui-monospace,Menlo,monospace;font-size:28px;letter-spacing:6px;">${code}</p>${emailButton(link, "Entrar")}<p style="margin:12px 0 0;color:#8b919c;font-size:12px;">Caducan en una hora y solo sirven una vez.</p>`,
      ),
    );
  } catch (e) {
    console.error("sendMagicLink", e);
  }
  return sent;
}

// Entrar con el código numérico del email (8 dígitos, la longitud configurada en
// Supabase). Máximo 5 intentos por envío y solo durante su hora de validez.
export async function verifyCode(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const code = String(formData.get("code") ?? "").replace(/\D/g, "");
  const fail = { message: "Código incorrecto o caducado.", error: true, email };

  if (!isAllowedEmail(email) || code.length !== 8) {
    await sleep(800 + Math.random() * 400);
    return fail;
  }

  // El intento se reserva antes de comprobar, en una sola operación atómica:
  // peticiones en paralelo no pueden saltarse el límite.
  const { data: attempts } = await createAdminClient().rpc("claim_code_attempt");
  if (attempts == null) return fail;
  if (attempts > 5) {
    return { message: "Demasiados intentos. Pide un código nuevo.", error: true, email };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
  if (error || !isAllowedEmail(data.user?.email)) return fail;
  redirect("/dashboard");
}

export async function confirmMagicLink(formData: FormData) {
  const tokenHash = String(formData.get("token_hash") ?? "");
  const supabase = await createClient();

  // El enlace es de un solo uso: si ya hay una sesión válida (doble toque,
  // el correo reabre el enlace…), se entra sin gastar ni romper nada.
  const {
    data: { user: current },
  } = await supabase.auth.getUser();
  if (isAllowedEmail(current?.email)) redirect("/dashboard");

  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "email",
  });

  if (error) redirect("/?error=enlace");
  if (!isAllowedEmail(data.user?.email)) {
    // Solo se cierra la sesión que acaba de abrirse si no es la del dueño.
    await supabase.auth.signOut({ scope: "local" });
    redirect("/?error=enlace");
  }
  redirect("/dashboard");
}

export async function syncNow() {
  await requireOwner();

  const results = await syncAll("manual");
  revalidatePath("/dashboard");
  return results.coinbase.ok && results.wallets.every((w) => w.ok);
}

export async function signOut() {
  const supabase = await createClient();
  // Solo este dispositivo: salir en el portátil no cierra la sesión del móvil.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/");
}
