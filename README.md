# Crypto Dashboard by Rupgo

Tu propio dashboard privado de inversiones crypto: une tu **cuenta de Coinbase** y tus **wallets** (por dirección pública) y te dice cuánto vale todo, cuánto has metido, qué rentabilidad llevas (total, al año y por moneda), si tus cambios entre monedas te han salido bien, a qué precio tiene que estar cada moneda para volver a positivo y tu informe fiscal por FIFO.

- **Solo lectura:** nunca puede mover fondos. No pide ni guarda claves privadas ni frases semilla.
- **Tuyo y privado:** usas tu propio Supabase, tu Vercel y tus claves. Nadie más ve tus datos, ni siquiera quien te pasó este repo.
- **Coste:** con los planes gratuitos de Supabase, Vercel, Resend y Zerion, 0 €.

## Qué necesitas

Cuentas gratuitas en [GitHub](https://github.com), [Vercel](https://vercel.com) (créala con GitHub), [Supabase](https://supabase.com), [Resend](https://resend.com) y [Zerion API](https://zerion.io/api), y tu cuenta de Coinbase.

> Puedes hacerlo todo pidiéndoselo a Claude Code: abre esta carpeta y dile *"sigue el README para instalarlo"*. Nunca le pegues claves en el chat: van directamente en Vercel.

## Instalación (unos 30 minutos)

### 1. Copia el repo

En GitHub pulsa **Fork** (o *Use this template*). Tendrás tu copia en tu cuenta.

### 2. Base de datos (Supabase)

1. Crea un proyecto nuevo en Supabase (región cercana, por ejemplo `eu-west`).
2. Ve a **SQL Editor**, pega todo el contenido de [`supabase/schema.sql`](supabase/schema.sql) y pulsa **Run**. Solo una vez.
3. Ve a **Authentication → Sign In / Providers** y desactiva **Allow new users to sign up** (la app crea tu usuario sola).
4. Apunta, de **Project Settings → API Keys**: la URL del proyecto, la *publishable key* (`sb_publishable_…`) y la *secret key* (`sb_secret_…`).

### 3. Claves de tus datos

- **Coinbase:** en [portal.cdp.coinbase.com](https://portal.cdp.coinbase.com) → API Keys → crea una *secret API key* con **solo View (read-only)** marcado (nada de Trade ni Transfer). Marca *Opt-out of IP allowlisting* (Vercel no tiene IPs fijas). Guarda el **API key ID** y el **Secret**: el secreto solo se muestra una vez.
- **Zerion:** crea una API key en el panel de Zerion. El plan gratuito tiene un cupo de peticiones; la app sincroniza las wallets cada 6 h para no pasarse y muestra el consumo en Ajustes.
- **Resend:** crea una API key. Para que los emails lleguen a cualquier dirección, verifica tu dominio en Resend; si no tienes dominio, usa `onboarding@resend.dev` como remitente, que solo entrega al email con el que creaste la cuenta de Resend (usa ese mismo email como `ALLOWED_EMAIL`).

### 4. Publica en Vercel

1. En Vercel: **Add New → Project** → importa tu fork.
2. Antes de desplegar, en **Environment Variables** añade las de [`.env.example`](.env.example):

| Variable | Valor |
|---|---|
| `ALLOWED_EMAIL` | Tu email (el único que podrá entrar) |
| `NEXT_PUBLIC_APP_NAME` | El nombre que quieras ver (opcional) |
| `NEXT_PUBLIC_SUPABASE_URL` | URL de tu proyecto de Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` |
| `SUPABASE_SECRET_KEY` | `sb_secret_…` |
| `RESEND_API_KEY` | Tu key de Resend |
| `EMAIL_FROM` | `Nombre <tu@tudominio.com>` o `Nombre <onboarding@resend.dev>` |
| `COINBASE_API_KEY_NAME` | El *API key ID* de Coinbase |
| `COINBASE_API_PRIVATE_KEY` | El *Secret* de Coinbase |
| `ZERION_API_KEY` | Tu key de Zerion |
| `CRON_SECRET` | Un texto largo aleatorio (por ejemplo, el resultado de `openssl rand -hex 32`) |
| `SYNC_CRON` | `0 6 * * *` (una vez al día; plan gratuito). En Vercel Pro: `0 * * * *` |

Las claves secretas (Supabase secret, Resend, Coinbase, Zerion, `CRON_SECRET`) márcalas como **Sensitive**.

3. Pulsa **Deploy**.

### 5. Primer acceso

1. Abre tu URL de Vercel, escribe tu email y pide el acceso. Te llega un enlace y un código; usa cualquiera de los dos.
2. Ve a **Ajustes** y añade la dirección pública de tu wallet (`0x…` o de Solana).
3. Pulsa **Sincronizar** (↻). La primera vez importa todo el historial de Coinbase y la wallet y reconstruye el gráfico día a día desde tu primer movimiento (puede tardar un par de minutos). Después se mantiene solo.

En el móvil puedes instalarla: en Safari, **Compartir → Añadir a pantalla de inicio**. En la app instalada entra con el **código** del email (la app y Safari no comparten sesión).

## Actualizar a nuevas versiones

Cuando haya mejoras en este repo:

1. En tu fork de GitHub pulsa **Sync fork → Update branch**. Vercel vuelve a desplegar solo.
2. Si la actualización cambia la base de datos, habrá un archivo nuevo en [`supabase/updates/`](supabase/updates): ejecútalo una vez en Supabase → SQL Editor.

## Cómo calcula

- **Dinero metido** = compras con euros + entradas desde fuera de tus cuentas − ventas a euros − salidas fuera. Lo que mueves entre tu Coinbase y tu wallet no cuenta.
- **Rentabilidad** = lo que vale hoy − dinero metido. **Al año (TIR)** tiene en cuenta cuándo entró cada euro.
- **Fiscal:** FIFO por año; las recompensas de staking cuentan a su valor al recibirlas. Es orientativo: valídalo con tu asesor.
- Si algún movimiento entre redes no se detecta bien (pasa con algunos puentes), se puede corregir a mano: ver `CLAUDE.md`.

## Desarrollo

```bash
npm install
```

```bash
vercel env pull .env.local
```

```bash
npm run dev
```

Stack: Next.js 16, TypeScript, Tailwind CSS v4, Recharts, Supabase, Vercel, Resend. Más detalles para desarrollar con Claude Code en [`CLAUDE.md`](CLAUDE.md).
