import { test } from "node:test";
import assert from "node:assert/strict";
import { xirr } from "../src/lib/xirr.ts";

const DAY = 86400000;
const t0 = Date.parse("2025-01-01T00:00:00Z");

test("1000 que valen 1100 al cabo de un año: 10 %", () => {
  const r = xirr([
    { t: t0, v: -1000 },
    { t: t0 + 365 * DAY, v: 1100 },
  ]);
  assert.ok(Math.abs(r! - 0.1) < 1e-6, String(r));
});

test("pérdidas: 1000 que valen 800 al año: −20 %", () => {
  const r = xirr([
    { t: t0, v: -1000 },
    { t: t0 + 365 * DAY, v: 800 },
  ]);
  assert.ok(Math.abs(r! + 0.2) < 1e-6, String(r));
});

test("una aportación a mitad de año pesa la mitad", () => {
  // 1000 al principio y 1000 a los 6 meses; al año valen 2150.
  const r = xirr([
    { t: t0, v: -1000 },
    { t: t0 + 182.5 * DAY, v: -1000 },
    { t: t0 + 365 * DAY, v: 2150 },
  ])!;
  // Comprobación: con esa tasa, el valor presente neto es 0.
  const npv = -1000 - 1000 / Math.pow(1 + r, 0.5) + 2150 / (1 + r);
  assert.ok(Math.abs(npv) < 1e-6, String(npv));
  assert.ok(r > 0.075 && r < 0.11, String(r));
});

test("sin flujos suficientes o sin cambio de signo no hay TIR", () => {
  assert.equal(xirr([{ t: t0, v: -1000 }]), null);
  assert.equal(
    xirr([
      { t: t0, v: -1000 },
      { t: t0 + DAY, v: -500 },
    ]),
    null,
  );
});
