"use client";

import { useState, useTransition } from "react";
import { syncNow } from "../actions";

export function SyncButton() {
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          setFailed(!(await syncNow()));
        })
      }
      aria-label={pending ? "Sincronizando" : "Sincronizar ahora"}
      className="h-9 whitespace-nowrap rounded-lg border border-border px-3 text-sm transition-colors hover:bg-surface disabled:opacity-60"
    >
      <span aria-hidden className="sm:hidden">
        {pending ? "…" : "↻"}
      </span>
      <span className="hidden sm:inline">
        {pending ? "Sincronizando…" : failed ? "Reintentar" : "Sincronizar ahora"}
      </span>
    </button>
  );
}
