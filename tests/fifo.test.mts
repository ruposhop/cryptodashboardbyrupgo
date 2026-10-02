import { test } from "node:test";
import assert from "node:assert/strict";
import { computeFifo, type Disposal, type FifoTx } from "../src/lib/fifo.ts";

const tx = (t: Partial<FifoTx> & Pick<FifoTx, "type" | "amount">): FifoTx => ({
  symbol: "BTC",
  valueEur: null,
  occurredAt: "2026-01-01T00:00:00Z",
  internal: false,
  ...t,
});
const bal = (entries: [string, number, number][]) =>
  new Map(entries.map(([s, amount, valueEur]) => [s, { amount, valueEur }]));
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);

test("vende primero lo que compró primero (FIFO)", () => {
  const disposals: Disposal[] = [];
  const [btc] = computeFifo(
    [
      tx({ type: "compra", amount: 1, valueEur: 100, occurredAt: "2026-01-01T00:00:00Z" }),
      tx({ type: "compra", amount: 1, valueEur: 200, occurredAt: "2026-02-01T00:00:00Z" }),
      tx({ type: "venta", amount: -1.5, valueEur: 450, occurredAt: "2026-03-01T00:00:00Z" }),
    ],
    bal([["BTC", 0.5, 150]]),
    disposals,
  );
  close(btc.realizedEur, 450 - (100 + 100)); // 1 a 100 + 0,5 a 200
  close(btc.costEur, 100); // quedan 0,5 a 200
  close(btc.breakEvenEur!, 200);
  close(btc.unrealizedEur, 50);
  assert.equal(disposals.length, 1);
  close(disposals[0].costEur, 200);
  assert.equal(disposals[0].unmatched, false);
});

test("en un swap a la misma hora entra antes de salir", () => {
  const at = "2026-01-01T10:00:00Z";
  const [eth] = computeFifo(
    [
      tx({ symbol: "ETH", type: "swap", amount: -1, valueEur: 2000, occurredAt: at }),
      tx({ symbol: "ETH", type: "swap", amount: 1, valueEur: 2000, occurredAt: at }),
    ],
    bal([["ETH", 0, 0]]),
  );
  assert.equal(eth.unmatchedEur, 0);
  close(eth.realizedEur, 0);
});

test("cbBTC y WBTC cuentan como BTC", () => {
  const result = computeFifo(
    [
      tx({ type: "compra", amount: 1, valueEur: 100 }),
      tx({ symbol: "cbBTC", type: "recepcion", amount: 1, valueEur: 300 }),
    ],
    bal([
      ["BTC", 1, 250],
      ["WBTC", 1, 250],
    ]),
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].symbol, "BTC");
  close(result[0].amount, 2);
  close(result[0].costEur, 400);
});

test("recompensas a su valor de mercado; mejoras de precio a coste 0", () => {
  const [ada] = computeFifo(
    [
      tx({ symbol: "ADA", type: "recompensa", amount: 10, valueEur: 5 }),
      tx({ symbol: "ADA", type: "ajuste", amount: 10, valueEur: 5 }),
    ],
    bal([["ADA", 20, 20]]),
  );
  close(ada.costEur, 5);
});

test("ignora el efectivo y los movimientos internos", () => {
  const result = computeFifo(
    [
      tx({ symbol: "EUR", type: "deposito", amount: 1000, valueEur: 1000 }),
      tx({ type: "compra", amount: 1, valueEur: 100 }),
      tx({ type: "envio", amount: -1, valueEur: 120, internal: true }),
      tx({ type: "interno", amount: -1, valueEur: 120 }),
    ],
    bal([["BTC", 1, 120], ["EUR", 0, 0]]),
  );
  assert.deepEqual(result.map((a) => a.symbol), ["BTC"]);
  close(result[0].costEur, 100);
  close(result[0].realizedEur, 0);
});

test("venta sin compra registrada: se avisa y cuenta como beneficio", () => {
  const disposals: Disposal[] = [];
  const [sol] = computeFifo(
    [tx({ symbol: "SOL", type: "venta", amount: -2, valueEur: 300 })],
    bal([]),
    disposals,
  );
  close(sol.unmatchedEur, 300);
  close(sol.realizedEur, 300);
  assert.equal(disposals[0].unmatched, true);
});

test("si el historial tiene más de lo que hay en el saldo, ese coste es pérdida", () => {
  const [btc] = computeFifo(
    [tx({ type: "compra", amount: 2, valueEur: 200 })],
    bal([["BTC", 1, 150]]),
  );
  close(btc.costEur, 100);
  close(btc.orphanCostEur, 100);
  close(btc.realizedEur, -100);
  close(btc.coverage, 1);
});

test("si falta historial, la parte sin historial cuenta a coste 0", () => {
  const [btc] = computeFifo(
    [tx({ type: "compra", amount: 1, valueEur: 100 })],
    bal([["BTC", 2, 300]]),
  );
  close(btc.coverage, 0.5);
  close(btc.costEur, 100);
  close(btc.breakEvenEur!, 50);
});
