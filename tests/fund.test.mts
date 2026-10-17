import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buyFees,
  buyMargin,
  computeContributions,
  swapCosts,
  uniqueBuys,
  type BuyRow,
  type FundTx,
} from "../src/lib/fund.ts";

const tx = (t: Partial<FundTx> & Pick<FundTx, "type" | "amount" | "value">): FundTx => ({
  occurredAt: "2026-01-01T00:00:00Z",
  internal: false,
  fiat: false,
  ...t,
});

test("dinero metido = compras + entradas − ventas − salidas", () => {
  const { contributed, parts, cashFlows } = computeContributions([
    tx({ type: "compra", amount: 1, value: 1000 }),
    tx({ type: "recepcion", amount: 5, value: 200 }),
    tx({ type: "venta", amount: -0.5, value: 300 }),
    tx({ type: "envio", amount: -1, value: 50 }),
  ]);
  assert.equal(contributed, 1000 + 200 - 300 - 50);
  assert.deepEqual(parts.compras, { count: 1, eur: 1000 });
  assert.deepEqual(parts.entradas, { count: 1, eur: 200 });
  assert.deepEqual(parts.ventas, { count: 1, eur: 300 });
  assert.deepEqual(parts.salidas, { count: 1, eur: 50 });
  // Para la TIR: lo que entra al fondo es negativo.
  assert.deepEqual(
    cashFlows.map((f) => f.v),
    [-1000, -200, 300, 50],
  );
});

test("no cuentan: internos, efectivo, recompensas, swaps ni ajustes", () => {
  const { contributed, cashFlows } = computeContributions([
    tx({ type: "envio", amount: -1, value: 500, internal: true }),
    tx({ type: "interno", amount: -1, value: 500 }),
    tx({ type: "compra", amount: 50, value: 50, fiat: true }),
    tx({ type: "recompensa", amount: 1, value: 10 }),
    tx({ type: "swap", amount: 1, value: 100 }),
    tx({ type: "ajuste", amount: 1, value: 1 }),
  ]);
  assert.equal(contributed, 0);
  assert.equal(cashFlows.length, 0);
});

const buy = (b: Partial<BuyRow>): BuyRow => ({
  id: "a",
  symbol: "BTC",
  fiat: false,
  amount: 0.001,
  date: "2026-01-01",
  total: 50,
  subtotal: 48.01,
  currency: "EUR",
  ...b,
});

test("una compra por pedido: se ignora la pata en efectivo y otras monedas", () => {
  const buys = uniqueBuys(
    [
      buy({ id: "a" }),
      buy({ id: "a", symbol: "EUR", fiat: true }), // pata en euros del mismo pedido
      buy({ id: "a" }), // duplicado
      buy({ id: "b", currency: "USD" }), // otra moneda
      buy({ id: "c", total: 0 }), // sin datos
      buy({ id: null }), // sin id: se cuenta
    ],
    "EUR",
  );
  assert.deepEqual(buys.map((b) => b.id), ["a", null]);
});

test("comisión de compra = total − subtotal", () => {
  const fees = buyFees([buy({}), buy({ total: 100, subtotal: 100 })]);
  assert.ok(Math.abs(fees - 1.99) < 1e-9);
});

test("margen en el precio frente al precio de mercado del día", () => {
  const { margin, coverage } = buyMargin(
    [
      buy({ amount: 0.001, subtotal: 48, date: "2026-01-01" }), // mercado: 47
      buy({ symbol: "XYZ", subtotal: 48, date: "2026-01-01" }), // sin precio
    ],
    (symbol) => (symbol === "BTC" ? 47000 : undefined),
  );
  assert.ok(Math.abs(margin - 1) < 1e-9);
  assert.equal(coverage, 0.5);
});

test("coste de los cambios: solo los que tienen sus dos patas", () => {
  const { cost, count } = swapCosts([
    { key: "t1", amount: -1, value: 100 },
    { key: "t1", amount: 50, value: 97 },
    { key: "t2", amount: -1, value: 10 }, // sin pata de entrada
    { key: null, amount: 5, value: 5 },
  ]);
  assert.equal(count, 1);
  assert.equal(cost, 3);
});
