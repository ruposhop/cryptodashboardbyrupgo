import { timingSafeEqual } from "node:crypto";

// Segunda comprobación además de la del proxy: la ruta no depende de él.
export function isCronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export const unauthorized = () =>
  Response.json({ error: "No autorizado" }, { status: 401 });
