# Crypto Dashboard by Rupgo

**Tu propio dashboard de inversiones crypto, privado, gratis y tuyo.** Une tu cuenta de Coinbase y tus wallets en una sola pantalla y responde a lo que de verdad importa:

- 💶 **¿Cuánto vale hoy todo lo que tengo** y cuánto he metido? Rentabilidad total, al año (TIR) y variación 24h / 7d / 30d.
- 📈 **¿Cómo ha evolucionado?** Gráfico día a día desde tu primer movimiento, reconstruido solo.
- 🪙 **¿Gano o pierdo con cada moneda?** Resultado por moneda, gráfico de precio con tus compras y ventas marcadas y todos sus movimientos.
- 🔁 **¿Me han salido bien los cambios entre monedas?** Cada cambio comparado con lo que tendrías si no lo hubieras hecho, y cuánto se fue en comisiones.
- 🎯 **¿A qué precio tiene que estar cada moneda** para volver a positivo?
- 🧾 **Informe fiscal** por FIFO y por año, con CSV para tu gestor.
- 🔔 **Alertas por email** de precio, de movimientos en tu wallet y si la sincronización falla.
- 🙈 Modo privacidad, app instalable en el móvil y tema oscuro.

> **Solo lectura y privado.** Nunca puede mover fondos, no pide claves privadas ni frases semilla, y cada persona lo instala con **sus propias** cuentas (Supabase, Vercel, Coinbase…). Nadie más ve tus datos, tampoco el autor de este repo.

---

## 🎓 Hecho por Rubén Benarroch · [rupgo.com](https://rupgo.com)

Este proyecto lo construí entero con IA (Claude Code), sin escribir el código a mano. **En [rupgo.com](https://rupgo.com) enseño a crear proyectos reales como este con inteligencia artificial**, desde la idea hasta tenerlo publicado con base de datos, emails, pagos y dominio propio. Si te gusta este dashboard y quieres aprender a crear los tuyos, [échale un vistazo a los cursos](https://rupgo.com).

---

## ✨ Instálalo con tu IA (recomendado)

1. Haz **Fork** de este repo en GitHub (botón arriba a la derecha) y clónalo en tu ordenador.
2. Abre la carpeta con **Claude Code** (u otro asistente de IA) y escríbele:

   > *Quiero instalar mi propio Crypto Dashboard. Sigue la guía docs/INSTALAR-CON-IA.md.*

3. Te irá guiando paso a paso: crear Supabase, sacar las claves de Coinbase (solo lectura) y Zerion, ponerlas en Vercel y entrar por primera vez. **No le pegues claves en el chat**: van directamente en Vercel.

La guía que sigue tu IA está en [`docs/INSTALAR-CON-IA.md`](docs/INSTALAR-CON-IA.md). También la puedes seguir tú a mano.

## 🧰 Qué necesitas

Cuentas gratuitas en [GitHub](https://github.com), [Vercel](https://vercel.com) (créala con GitHub), [Supabase](https://supabase.com), [Resend](https://resend.com) y [Zerion API](https://zerion.io/api), y tu cuenta de Coinbase. **Coste: 0 €** con los planes gratuitos.

## 🛠️ Instalación a mano (unos 30 minutos)

1. **Copia el repo:** Fork en GitHub.
2. **Supabase:** crea un proyecto, pega todo [`supabase/schema.sql`](supabase/schema.sql) en **SQL Editor → Run** (una vez) y desactiva **Authentication → Sign In / Providers → Allow new users to sign up**. Apunta la URL, la *publishable key* y la *secret key* (Project Settings → API Keys).
3. **Claves:**
   - **Coinbase:** [portal.cdp.coinbase.com](https://portal.cdp.coinbase.com) → API Keys → *secret API key* con **solo View (read-only)** y *Opt-out of IP allowlisting*. Guarda el API key ID y el Secret (solo se muestra una vez).
   - **Zerion:** una API key (plan gratuito).
   - **Resend:** una API key. Sin dominio propio, usa `onboarding@resend.dev` como remitente (solo entrega al email de tu cuenta de Resend).
4. **Vercel:** importa tu fork y, antes de desplegar, crea las variables de [`.env.example`](.env.example) en **Settings → Environment Variables** (las secretas como *Sensitive*):

| Variable | Valor |
|---|---|
| `ALLOWED_EMAIL` | Tu email (el único que podrá entrar) |
| `NEXT_PUBLIC_APP_NAME` | El nombre que quieras ver (opcional) |
| `NEXT_PUBLIC_REPO_URL` | Enlace al código en la página de inicio (opcional; por defecto, este repo) |
| `NEXT_PUBLIC_SUPABASE_URL` | URL de tu proyecto de Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` |
| `SUPABASE_SECRET_KEY` | `sb_secret_…` |
| `RESEND_API_KEY` | Tu key de Resend |
| `EMAIL_FROM` | `Nombre <tu@tudominio.com>` o `Nombre <onboarding@resend.dev>` |
| `COINBASE_API_KEY_NAME` | El *API key ID* de Coinbase |
| `COINBASE_API_PRIVATE_KEY` | El *Secret* de Coinbase |
| `ZERION_API_KEY` | Tu key de Zerion |
| `CRON_SECRET` | Un texto largo aleatorio (`openssl rand -hex 32`) |

5. **Despliega y entra:** abre tu URL, pide el acceso con tu email (llega un enlace y un código), añade tu wallet en **Ajustes** y pulsa **↻**. La primera sincronización importa todo tu historial y reconstruye el gráfico.

En el móvil puedes instalarla: en Safari, **Compartir → Añadir a pantalla de inicio**. En la app instalada entra con el **código** del email.

## ⏱️ Sincronizar cada hora (opcional, gratis)

Vercel sincroniza sola una vez al día y siempre puedes pulsar ↻. Para tener datos cada hora, este repo trae un workflow de GitHub Actions:

1. En tu fork: **Actions** → activa los workflows.
2. **Settings → Secrets and variables → Actions**, crea `SYNC_URL` (`https://TU-DOMINIO/api/cron/sync`; debe ser accesible, por ejemplo tu dominio propio) y `CRON_SECRET` (el mismo que en Vercel).
3. Pruébalo en **Actions → Sincronización cada hora → Run workflow**.

## 🔄 Recibe las mejoras

Este repo se actualiza con nuevas funciones. Para tenerlas:

1. En tu fork de GitHub pulsa **Sync fork → Update branch** (o pídeselo a tu IA). Vercel vuelve a desplegar solo.
2. Si la actualización cambia la base de datos, habrá un archivo nuevo en [`supabase/updates/`](supabase/updates): ejecútalo una vez en Supabase → SQL Editor.

## 🧮 Cómo calcula

- **Dinero metido** = compras con euros + entradas desde fuera de tus cuentas − ventas a euros − salidas fuera. Lo que mueves entre tu Coinbase y tu wallet no cuenta.
- **Rentabilidad** = lo que vale hoy − dinero metido. **Al año (TIR)** tiene en cuenta cuándo entró cada euro.
- **Fiscal:** FIFO por año; las recompensas de staking cuentan a su valor al recibirlas. Es orientativo: valídalo con tu asesor.

## 🔒 Seguridad

- La API key de Coinbase es de **solo lectura** y vive en tus variables de Vercel; solo la usa el servidor.
- Solo tu email puede entrar (enlace o código de un solo uso, con límite de intentos). La base de datos tiene RLS: nadie más puede leerla.
- Ninguna clave se guarda en el código. Si ves alguna en un fork, es un error de quien la subió: regénérala.

## 💻 Desarrollo

```bash
npm install
```

```bash
vercel env pull .env.local
```

```bash
npm run dev
```

Stack: Next.js 16, TypeScript, Tailwind CSS v4, Recharts, Supabase, Vercel, Resend. Si desarrollas con Claude Code, lee [`CLAUDE.md`](CLAUDE.md).

## 📄 Licencia

[MIT](LICENSE): puedes usarlo, modificarlo y compartirlo libremente, manteniendo el aviso de copyright.

---

¿Te ha servido? Dale una ⭐ al repo y, si quieres aprender a crear proyectos así con IA, te espero en **[rupgo.com](https://rupgo.com)**. — *Rubén Benarroch*
