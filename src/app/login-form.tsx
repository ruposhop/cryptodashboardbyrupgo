"use client";

import { useActionState } from "react";
import { sendMagicLink, verifyCode, type LoginState } from "./actions";

const field =
  "h-12 rounded-lg border border-border bg-surface px-4 outline-none focus:border-foreground";
const primary =
  "h-12 rounded-lg bg-foreground font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60";

export function LoginForm({ initialError }: { initialError?: string }) {
  const [sent, send, sending] = useActionState<LoginState, FormData>(
    sendMagicLink,
    initialError ? { message: initialError, error: true } : null,
  );
  const [checked, check, checking] = useActionState<LoginState, FormData>(verifyCode, null);

  // Tras pedir el enlace aparece el paso del código (útil en la app instalada).
  const email = checked?.email ?? sent?.email;

  return (
    <div className="mt-8">
      <form action={send} className="flex flex-col gap-3">
        <label htmlFor="email" className="text-sm text-muted">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          defaultValue={email}
          className={field}
        />
        <button
          type="submit"
          disabled={sending}
          className={`mt-2 ${email ? "h-12 rounded-lg border border-border font-medium disabled:opacity-60" : primary}`}
        >
          {sending ? "Enviando…" : email ? "Enviar otro" : "Enviar enlace de acceso"}
        </button>
        <p role="status" className={`min-h-5 text-sm ${sent?.error ? "text-loss" : "text-muted"}`}>
          {sent?.message}
        </p>
      </form>

      {email && (
        <form action={check} className="mt-4 flex flex-col gap-3 border-t border-border pt-6">
          <input type="hidden" name="email" value={email} />
          <label htmlFor="code" className="text-sm text-muted">
            O escribe el código del email
          </label>
          <input
            id="code"
            name="code"
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{8}"
            maxLength={8}
            placeholder="12345678"
            className={`${field} text-center font-mono text-2xl tracking-[0.3em]`}
          />
          <button type="submit" disabled={checking} className={primary}>
            {checking ? "Comprobando…" : "Entrar"}
          </button>
          <p role="status" className="min-h-5 text-sm text-loss">
            {checked?.error ? checked.message : ""}
          </p>
        </form>
      )}
    </div>
  );
}
