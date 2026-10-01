"use client";

import { useActionState } from "react";
import { addWallet, type WalletState } from "./actions";

export function AddWalletForm() {
  const [state, action, pending] = useActionState<WalletState, FormData>(addWallet, null);
  const field =
    "h-10 rounded-lg border border-border bg-surface px-3 text-sm outline-none focus:border-foreground";

  return (
    <div className="mt-4">
      <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex flex-col gap-1 text-xs text-muted sm:w-40">
          Etiqueta
          <input name="label" placeholder="Wallet" maxLength={40} className={field} />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-xs text-muted">
          Dirección pública
          <input
            name="address"
            required
            placeholder="0x… o dirección de Solana"
            autoComplete="off"
            spellCheck={false}
            className={`${field} font-mono`}
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-lg bg-foreground px-4 text-sm font-medium text-background disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Añadir"}
        </button>
      </form>
      <p role="status" className={`mt-2 min-h-5 text-sm ${state?.error ? "text-loss" : "text-muted"}`}>
        {state?.message}
      </p>
    </div>
  );
}
