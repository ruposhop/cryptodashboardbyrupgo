"use client";

import { useFormStatus } from "react-dom";

// Se bloquea al pulsar: un segundo envío gastaría un enlace ya usado.
export function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-12 w-full rounded-lg bg-foreground font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "Entrando…" : "Entrar al dashboard"}
    </button>
  );
}
