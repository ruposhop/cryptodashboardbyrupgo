import Link from "next/link";
import { signOut } from "@/app/actions";
import { SyncButton } from "@/app/dashboard/sync-button";
import { PrivacyToggle } from "@/components/privacy-toggle";
import { APP_NAME } from "@/lib/app-config";

const NAV = [
  { href: "/dashboard", label: "Resumen" },
  { href: "/activo", label: "Monedas" },
  { href: "/cambios", label: "Cambios" },
  { href: "/movimientos", label: "Movimientos" },
  { href: "/fiscal", label: "Fiscal" },
  { href: "/ajustes", label: "Ajustes" },
];

export function AppHeader({ current }: { current: string }) {
  return (
    <header className="print:hidden">
      <div className="flex items-center justify-between gap-3">
        <Link href="/dashboard" className="font-mono text-sm tracking-tight">
          {APP_NAME}
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <PrivacyToggle />
          <SyncButton />
          <form action={signOut}>
            <button type="submit" className="text-sm text-muted hover:text-foreground">
              Salir
            </button>
          </form>
        </div>
      </div>
      <nav aria-label="Secciones" className="mt-4 flex gap-1 overflow-x-auto border-b border-border [scrollbar-width:none]">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current === item.href ? "page" : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors ${
              current === item.href
                ? "border-foreground text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
