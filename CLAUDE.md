@AGENTS.md

# Crypto Dashboard by Rupgo

Dashboard privado y de **solo lectura** para seguir una cartera crypto personal: cuenta de Coinbase + wallet propia (direcciones públicas). Cada persona lo instala con su propio Supabase, Vercel y claves; un único usuario por instalación.

Lo vemos como un **fondo personal**: la métrica principal es la rentabilidad (valor hoy − dinero metido neto, y TIR anual). "Realizado / no realizado" (FIFO) es solo para la parte fiscal.

**Producto: `docs/MASTERPLAN.md`.** Si algo no está ahí, no se construye sin preguntar.

Si existe `CLAUDE.local.md` (no se sube a GitHub), tiene las notas privadas de esta instalación: léelas, pero **nunca copies nada de ahí ni de `private/` a archivos versionados**.

## Stack

- Next.js 16 (App Router, Server Components, Route Handlers) · TypeScript · Tailwind CSS v4 · Recharts
- Supabase (Postgres + Auth + RLS) · Vercel (hosting + Cron, configurado en `vercel.ts`) · Resend (emails)
- Datos: Coinbase API (key de solo lectura), Zerion (wallet), API pública de Coinbase Exchange (precios históricos)

## Comandos

- `npm run dev` — servidor de desarrollo (http://localhost:3000)
- `npm run build` — build de producción (pásalo antes de dar por buena una tarea grande)
- `npm run lint` — ESLint

## Estructura

- `README.md` — guía de instalación para cualquier persona
- `docs/MASTERPLAN.md` — qué hace el producto
- `src/app/` — rutas. `/` es **solo el login** (magic link o código por email); no hay contenido público. App: `/dashboard`, `/activo` y `/activo/[symbol]`, `/cambios`, `/movimientos`, `/fiscal`, `/ajustes`. Cada página privada llama a `requireOwner()` (`src/lib/session.ts`) además del proxy
- `src/proxy.ts` — protege todas las rutas y `/api/*`. Públicas solo `/`, `/auth/confirm`, manifest e iconos
- `src/lib/app-config.ts` — nombre de la app y remitente (variables de entorno)
- `src/lib/owner.ts` — copia `ALLOWED_EMAIL` a `app_settings`; las políticas RLS usan `is_owner()`
- `src/lib/fifo.ts` — motor FIFO (función pura). cbBTC/WBTC/ETH2 cuentan como BTC/ETH
- `src/lib/portfolio.ts` — rentabilidad del fondo, posiciones y resultado por moneda
- `src/lib/strategy.ts` — análisis de cambios entre monedas (cada cambio vs no haberlo hecho)
- `src/lib/sync/` — sincronización (Coinbase cada vez que corre el cron, wallet vía Zerion cada 6 h), alertas (`src/lib/alerts.ts`) e histórico (`src/lib/history.ts`)
- `supabase/schema.sql` — esquema completo para instalaciones nuevas. Cambios de esquema: actualiza `schema.sql` **y** añade un archivo en `supabase/updates/` con la fecha para quien ya lo tenga instalado
- Correcciones manuales de datos: filas en `transactions` con `external_id` que empieza por `manual:` y `raw.nota` con el motivo (la sincronización no las toca)
- `.claude/launch.json` — vista previa en el panel Browser

## Convenciones

- Interfaz y textos en español. Importes en EUR con formato `es-ES`.
- Tema oscuro único. Cifras en tipografía monoespaciada (`font-mono tabular-nums`). Verde y rojo **solo** para ganancias y pérdidas (`text-gain` / `text-loss`).
- Mobile-first. Server Components por defecto; `"use client"` solo donde haya interacción.
- Todo el sitio es `noindex`.
- Nada personal en el código: nombres, emails, dominios y frecuencias van en variables de entorno.

## Workflow

- Antes de dar una tarea por terminada, verifica el resultado en el navegador. Cambios visuales: captura a 1440px y a 375px.
- No instales dependencias que la tarea no necesite.

## Ramas

Solo dos ramas fijas; nunca crees otras por tu cuenta.

- `main` = PRODUCCIÓN. También: "producción", "prod", "online", "la web", "publicar".
- `staging` = DESARROLLO. También: "desarrollo", "dev", "entorno de pruebas".
- Todos los commits van en `staging`; `staging` pasa a `main` solo mediante pull request.

## Seguridad

- La app nunca puede mover fondos. Nunca se piden ni se guardan seed phrases ni claves privadas.
- La API key de Coinbase solo tiene permiso `view`, vive en variables de entorno y solo se usa en el servidor.
- Nunca pedir ni aceptar claves, tokens o contraseñas por el chat: se crean en Vercel y se traen con `vercel env pull`. Nada de secretos en código ni en archivos versionados.
- `SUPABASE_SECRET_KEY` y `CRON_SECRET` solo en servidor. RLS activado en todas las tablas; las escrituras van por el cliente admin (`src/lib/supabase/admin.ts`).
- `/api/cron/*` no usa sesión: se protege con `CRON_SECRET`.
- Emails: siempre con `sendEmail` + `emailTemplate`.

## Nunca sin confirmación explícita del dueño

- Borrados o cambios destructivos en la base de datos de producción
- Cambios de DNS, dominios o permisos (Vercel, Supabase, GitHub)
- Cambiar los permisos de la API key de Coinbase o añadir cualquier capacidad de escritura sobre las carteras
- Decisiones de criterio fiscal (FIFO, tratamiento del staking)
