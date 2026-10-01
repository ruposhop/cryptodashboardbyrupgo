"use client";

import { useEffect, useSyncExternalStore } from "react";

const KEY = "crypto-privacy";
const EVENT = "crypto-privacy-change";

function read() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

// Modo privacidad (MASTERPLAN §4): difumina todas las cifras (las que usan
// tabular-nums, ver globals.css). Se recuerda en este navegador.
export function PrivacyToggle() {
  const on = useSyncExternalStore(subscribe, read, () => false);

  useEffect(() => {
    document.documentElement.toggleAttribute("data-privacy", on);
  }, [on]);

  const toggle = () => {
    try {
      localStorage.setItem(KEY, on ? "0" : "1");
    } catch {}
    window.dispatchEvent(new Event(EVENT));
  };

  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={toggle}
      title={on ? "Mostrar cifras" : "Ocultar cifras"}
      className="h-9 rounded-lg border border-border px-2.5 text-sm text-muted transition-colors hover:text-foreground"
    >
      <span aria-hidden>{on ? "◉" : "◎"}</span>
      <span className="sr-only">{on ? "Mostrar cifras" : "Ocultar cifras"}</span>
    </button>
  );
}
