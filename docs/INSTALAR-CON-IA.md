# Guía para la IA: instalar y actualizar este proyecto

> Este archivo es para el asistente de IA (Claude Code, Cursor, Codex…) que ayuda a una persona a levantar **su propio** Crypto Dashboard by Rupgo. Si eres esa IA: sigue los pasos en orden, explícale cada uno en una frase sencilla y en su idioma, y no avances hasta verificar el anterior.

## Reglas que no se rompen

1. **Nunca pidas ni aceptes claves, tokens o contraseñas en el chat.** Las claves las pega la persona directamente en Vercel (Settings → Environment Variables) o en su propio terminal. Si la persona pega una clave en el chat, dile que la regenere en el servicio correspondiente y que la ponga solo en Vercel.
2. **Solo lectura:** la API key de Coinbase debe tener **únicamente** el permiso View. Nunca Trade ni Transfer. La app jamás necesita claves privadas ni frases semilla de wallets: si alguien las menciona, dile que no las comparta con nadie.
3. **Nada personal en el repo.** Emails, direcciones de wallet, IDs de proyectos o dominios van en variables de entorno o en la base de datos, no en archivos versionados. Las notas personales de la instalación van en `CLAUDE.local.md` (está en `.gitignore`).
4. Antes de dar un paso por terminado, **compruébalo** (comando, URL o captura).

## 0. Comprobar el ordenador

Comprueba (y si falta, ofrece instalar): Git, Node.js 20 o superior, npm, GitHub CLI (`gh`, con sesión iniciada) y Vercel CLI (`vercel`, con sesión iniciada). Confirma que estás en la carpeta del proyecto y que existe `supabase/schema.sql`.

## 1. Su copia del repo

- Si la persona aún no tiene copia: que haga **Fork** de `github.com/ruposhop/cryptodashboardbyrupgo` en GitHub (o `gh repo fork ruposhop/cryptodashboardbyrupgo --clone`). Recomienda fork: así recibirá las mejoras con "Sync fork".
- Si ha clonado sin fork, añade el original como `upstream`:

```bash
git remote add upstream https://github.com/ruposhop/cryptodashboardbyrupgo.git
```

- Ejecuta `npm install`.

## 2. Supabase (base de datos y login)

1. Que cree un proyecto en supabase.com (región cercana). Si tienes el MCP de Supabase, puedes crearlo tú tras confirmar el coste con la persona (el plan gratuito sirve).
2. Aplica **una vez** todo `supabase/schema.sql`: con el MCP (`apply_migration`) o pidiéndole que lo pegue en **SQL Editor → Run**.
3. Verifica que existen las tablas `transactions`, `balances`, `app_settings` y la función `is_owner`.
4. Pídele que desactive **Authentication → Sign In / Providers → Allow new users to sign up**.
5. Necesitará de **Project Settings → API Keys**: la URL del proyecto, la *publishable key* (`sb_publishable_…`) y la *secret key* (`sb_secret_…`). La URL y la publishable no son secretas; la secret key va solo a Vercel.

## 3. Claves de sus datos

Guíale para crearlas (las copiará directamente a Vercel en el paso 4):

- **Coinbase:** portal.cdp.coinbase.com → API Keys → *Create secret API key*: marcar **solo View (read-only)**, Portfolio "Primary", y *Opt-out of IP allowlisting*. Guardar el **API key ID** y el **Secret** (solo se muestra una vez). Vale cualquier algoritmo (Ed25519 o ECDSA).
- **Zerion:** API key en el panel de desarrolladores de Zerion (plan gratuito).
- **Resend:** API key. Remitente: si tiene un dominio, que lo verifique en Resend y use `Nombre <algo@sudominio.com>`; si no, `Nombre <onboarding@resend.dev>`, que solo entrega al email con el que creó la cuenta de Resend (ese debe ser su `ALLOWED_EMAIL`).
- **CRON_SECRET:** genera un valor aleatorio en su terminal con `openssl rand -hex 32` y que lo copie él (no lo muestres en el chat si puedes evitarlo).

## 4. Vercel (publicar)

1. En vercel.com: **Add New → Project → Import** su fork. (O con CLI: `vercel link` y `vercel git connect`.)
2. Antes de desplegar, que cree las variables de `.env.example` en **Settings → Environment Variables**, para Production, Preview y Development. Las secretas, marcadas como *Sensitive*:

| Variable | Qué es |
|---|---|
| `ALLOWED_EMAIL` | Su email, el único que podrá entrar |
| `NEXT_PUBLIC_APP_NAME` | Nombre visible (opcional) |
| `NEXT_PUBLIC_REPO_URL` | Enlace al código en la página de inicio (opcional) |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY` | Supabase |
| `RESEND_API_KEY` / `EMAIL_FROM` | Emails |
| `COINBASE_API_KEY_NAME` / `COINBASE_API_PRIVATE_KEY` | API key ID y Secret de Coinbase |
| `ZERION_API_KEY` | Zerion |
| `CRON_SECRET` | El valor aleatorio |

3. Despliega y verifica que la URL de producción muestra la pantalla de acceso.
4. Para trabajar en local: `vercel env pull .env.local` y `npm run dev` (las variables *Sensitive* no se descargan: lo que dependa de ellas solo funciona en producción).

## 5. Primer uso

1. Que abra su URL, ponga su email y pida el acceso: llega un enlace y un código de 8 dígitos.
2. **Ajustes →** añadir la dirección pública de su wallet (`0x…` o Solana).
3. Pulsar **↻ Sincronizar**. La primera vez importa todo el historial y reconstruye el gráfico (1-2 minutos).
4. Revisa con él el Resumen. Si algo no cuadra, mira "Problemas frecuentes".

Opcional: sincronización cada hora con GitHub Actions (README → "Sincronizar cada hora") y dominio propio en Vercel.

## 6. Actualizar a una versión nueva

1. Fork: en GitHub **Sync fork → Update branch** (o `gh repo sync`). Clon con `upstream`: `git pull upstream main` y `git push`.
2. Si hay archivos nuevos en `supabase/updates/` posteriores a su instalación, aplícalos en orden (MCP o SQL Editor).
3. Vercel despliega solo. Verifica la URL.

## Problemas frecuentes

| Síntoma | Causa probable |
|---|---|
| No llega el email de acceso | `EMAIL_FROM` con un dominio no verificado en Resend, o usa `onboarding@resend.dev` con un `ALLOWED_EMAIL` distinto del de la cuenta de Resend. Máximo 1 envío por minuto. |
| Entra pero el dashboard está vacío | No se ha sincronizado aún, o `schema.sql` no se aplicó, o `ALLOWED_EMAIL` no coincide con el email con el que entra. |
| Coinbase con error en Ajustes | Key sin permiso View, ID o secreto copiados incompletos, o la variable no está en Production. |
| Wallet con error 429 | Cupo de Zerion: espera; la wallet se sincroniza cada 6 h. |
| El despliegue falla con un error de cron | El plan Hobby solo admite crons diarios: `vercel.json` ya usa uno diario; no lo cambies a horario sin Vercel Pro. |
| Movimientos entre redes contados como entrada y salida externas | Algunos puentes no se detectan; se corrige a mano (ver `CLAUDE.md`, "Correcciones manuales"). |
