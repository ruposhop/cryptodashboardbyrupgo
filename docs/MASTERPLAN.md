# MASTERPLAN — Crypto Dashboard by Rupgo

> Dashboard personal de inversiones crypto. Stack: Next.js (App Router) · Vercel · Supabase.

## 1. Qué es

Un dashboard **privado y de solo lectura** que reúne en una pantalla el estado y la rentabilidad de una cartera crypto repartida entre:

1. **Una cuenta de Coinbase** (exchange), leída con una API key de solo lectura.
2. **Una o varias wallets propias** (self-custody), leídas por su dirección pública con Zerion.

Responde a:

- ¿Cuánto vale hoy todo lo que tengo (en su moneda: euros, dólares…)?
- ¿Cuánto he metido y qué rentabilidad llevo, en total, al año y por moneda?
- ¿Me han salido bien los cambios entre monedas?
- ¿Estoy por encima o por debajo de mi punto de equilibrio, en el fondo y en cada moneda?
- ¿Qué movimientos he hecho y cuándo?

**Solo lectura:** la app nunca puede mover fondos. No guarda claves privadas ni frases semilla.

## 2. Usuario

Una persona por instalación, que acumula a largo plazo como un fondo personal: compra, rota entre monedas y apenas pasa a euros. Lo consulta desde el móvil y el portátil, en la moneda de su cuenta de Coinbase (EUR, USD…; se puede forzar con `CURRENCY`). La moneda es fija por instalación.

## 3. Funcionalidades

- **Página de inicio:** solo el login, una frase de qué es y el enlace al código (`NEXT_PUBLIC_REPO_URL`, por defecto el repo original).
- **Acceso privado:** login por enlace o código de un solo uso enviado al email del dueño (`ALLOWED_EMAIL`). Cualquier otro email no recibe nada.
- **Sincronización:** Vercel Cron + botón "Sincronizar ahora". Coinbase (cuentas, saldos, movimientos) y wallets (saldos y movimientos por red). Todo se guarda en Supabase; el dashboard lee de la base de datos.
- **Resumen:** valor total, variación 24h/7d/30d, dinero metido, rentabilidad (€, %, TIR anual), gráfico de evolución desde el primer movimiento, reparto por moneda y por ubicación, posiciones.
- **Dinero metido y comisiones:** de dónde sale "dinero metido" (compras, entradas y salidas, para cuadrarlo con el banco) y cuánto se ha ido en comisiones: comisión de compra declarada, margen en el precio de compra (estimado con el cierre diario), cambios entre monedas y gas de la wallet. Ya están restadas en la rentabilidad; aquí solo se separan.
- **Tu punto de equilibrio:** si el fondo está por encima o por debajo de lo metido (con una barra), cuánto podría caer sin perder dinero o cuánto tiene que subir, qué parte del resultado viene de lo que tienes y qué parte de monedas que ya no tienes, y por moneda su precio de equilibrio y a qué distancia está.
- **Monedas:** resultado total por moneda (lo sacado + lo que queda − lo metido), gráfico de precio con las operaciones y todos sus movimientos.
- **Cambios:** cada cambio entre monedas (qué diste, qué recibiste, comisión) y cómo le ha ido hasta hoy frente a no haberlo hecho.
- **Movimientos:** lista unificada con filtros y enlace al explorador de bloques. Las transferencias entre tus propias cuentas se detectan y no cuentan como compra ni venta.
- **Fiscal:** ganancias y pérdidas por FIFO por año (ventas y permutas), recompensas aparte, CSV. Orientativo: validar con un asesor.
- **Alertas por email:** precio objetivo por moneda, movimientos nuevos en la wallet y fallos de la sincronización (como mucho uno al día). El dashboard avisa si la última sincronización falló o hace más de un día que no hay datos.
- **Ajustes:** direcciones de wallet, estado de las conexiones, alertas activas.
- **Modo privacidad** y app instalable en el móvil.

## 4. Criterios de cálculo

- Dinero metido = lo pagado en compras (comisión incluida) + entradas desde fuera de tus cuentas − ventas a dinero − salidas fuera. Todo en la moneda de la instalación.
- Fiscal: FIFO; las recompensas de staking entran a su valor de mercado al recibirlas.
- Los movimientos entre tus propias cuentas (mismo hash) no cuentan.

## 5. Arquitectura

- Next.js en Vercel: cron diario de Vercel y, opcional, cada hora con GitHub Actions.
- Supabase: tablas `sources`, `assets`, `balances`, `transactions`, `portfolio_snapshots`, `sync_runs`, `price_history`, `price_alerts`, `app_settings`, `magic_link_sends`. RLS en todas; solo el dueño lee.
- Coinbase (API key `view`), Zerion (wallet), Coinbase Exchange público (precios históricos), Resend (emails).
