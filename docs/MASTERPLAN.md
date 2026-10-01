# MASTERPLAN — Crypto Dashboard by Rupgo

> Dashboard personal de inversiones crypto. Stack: Next.js (App Router) · Vercel · Supabase.

## 1. Qué es

Un dashboard **privado y de solo lectura** que reúne en una pantalla el estado y la rentabilidad de una cartera crypto repartida entre:

1. **Una cuenta de Coinbase** (exchange), leída con una API key de solo lectura.
2. **Una o varias wallets propias** (self-custody), leídas por su dirección pública con Zerion.

Responde a:

- ¿Cuánto vale hoy todo lo que tengo (en EUR)?
- ¿Cuánto he metido y qué rentabilidad llevo, en total, al año y por moneda?
- ¿Me han salido bien los cambios entre monedas?
- ¿A qué precio tiene que estar cada moneda para volver a positivo?
- ¿Qué movimientos he hecho y cuándo?

**Solo lectura:** la app nunca puede mover fondos. No guarda claves privadas ni frases semilla.

## 2. Usuario

Una persona por instalación, que acumula a largo plazo como un fondo personal: compra, rota entre monedas y apenas pasa a euros. Lo consulta desde el móvil y el portátil, en EUR.

## 3. Funcionalidades

- **Acceso privado:** login por enlace o código de un solo uso enviado al email del dueño (`ALLOWED_EMAIL`). Cualquier otro email no recibe nada.
- **Sincronización:** Vercel Cron + botón "Sincronizar ahora". Coinbase (cuentas, saldos, movimientos) y wallets (saldos y movimientos por red). Todo se guarda en Supabase; el dashboard lee de la base de datos.
- **Resumen:** valor total, variación 24h/7d/30d, dinero metido, rentabilidad (€, %, TIR anual), gráfico de evolución desde el primer movimiento, reparto por moneda y por ubicación, posiciones.
- **Para estar en positivo:** precio de equilibrio por moneda y precio necesario para que el fondo vuelva a valer lo metido.
- **Monedas:** resultado total por moneda (lo sacado + lo que queda − lo metido), gráfico de precio con las operaciones y todos sus movimientos.
- **Cambios:** cada cambio entre monedas (qué diste, qué recibiste, comisión) y cómo le ha ido hasta hoy frente a no haberlo hecho.
- **Movimientos:** lista unificada con filtros y enlace al explorador de bloques. Las transferencias entre tus propias cuentas se detectan y no cuentan como compra ni venta.
- **Fiscal:** ganancias y pérdidas por FIFO por año (ventas y permutas), recompensas aparte, CSV. Orientativo: validar con un asesor.
- **Alertas por email:** precio objetivo por moneda y movimientos nuevos en la wallet.
- **Ajustes:** direcciones de wallet, estado de las conexiones, alertas activas.
- **Modo privacidad** y app instalable en el móvil.

## 4. Criterios de cálculo

- Dinero metido = compras con euros + entradas desde fuera de tus cuentas − ventas a euros − salidas fuera.
- Fiscal: FIFO; las recompensas de staking entran a su valor de mercado al recibirlas.
- Los movimientos entre tus propias cuentas (mismo hash) no cuentan.

## 5. Arquitectura

- Next.js en Vercel: cron diario de Vercel y, opcional, cada hora con GitHub Actions.
- Supabase: tablas `sources`, `assets`, `balances`, `transactions`, `portfolio_snapshots`, `sync_runs`, `price_history`, `price_alerts`, `app_settings`, `magic_link_sends`. RLS en todas; solo el dueño lee.
- Coinbase (API key `view`), Zerion (wallet), Coinbase Exchange público (precios históricos), Resend (emails).
