const DAY = 86400000;

// TIR (tasa interna de rentabilidad) anualizada de flujos con fecha:
// negativos = dinero que entra al fondo, positivo final = lo que vale hoy.
export function xirr(flows: { t: number; v: number }[]) {
  if (flows.length < 2) return null;
  const t0 = flows[0].t;
  const npv = (r: number) =>
    flows.reduce((s, f) => s + f.v / Math.pow(1 + r, (f.t - t0) / (365 * DAY)), 0);
  let lo = -0.99;
  let hi = 10;
  if (npv(lo) * npv(hi) > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (npv(lo) * npv(mid) <= 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}
