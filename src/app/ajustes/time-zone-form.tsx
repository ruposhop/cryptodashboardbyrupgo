"use client";

import { useActionState, useMemo, useState, useSyncExternalStore } from "react";
import { updateTimeZone, type PrefsState } from "./actions";

const noop = () => () => {};

// Zona horaria con la que se muestran las fechas. Propone la del dispositivo.
export function TimeZoneForm({ current, zones: list }: { current: string; zones: string[] }) {
  const [state, action, pending] = useActionState<PrefsState, FormData>(updateTimeZone, null);
  const [zone, setZone] = useState(current);
  const zones = useMemo(() => (list.includes(current) ? list : [current, ...list]), [list, current]);
  // Solo en el navegador: el servidor no sabe en qué zona está tu dispositivo.
  const device = useSyncExternalStore(
    noop,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => null,
  );

  return (
    <form action={action} className="flex flex-col gap-3">
      <label htmlFor="timeZone" className="text-sm text-muted">
        Zona horaria
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <select
          id="timeZone"
          name="timeZone"
          value={zone}
          onChange={(e) => setZone(e.target.value)}
          className="h-11 min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 outline-none focus:border-foreground"
        >
          {zones.map((z) => (
            <option key={z} value={z}>
              {z.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending || zone === current}
          className="h-11 rounded-lg bg-foreground px-4 font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Guardar"}
        </button>
      </div>
      {device && device !== zone && (
        <button
          type="button"
          onClick={() => setZone(device)}
          className="self-start text-sm text-muted underline underline-offset-2 hover:text-foreground"
        >
          Usar la de este dispositivo ({device.replaceAll("_", " ")})
        </button>
      )}
      {state && (
        <p role="status" className={`text-sm ${state.error ? "text-loss" : "text-muted"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
