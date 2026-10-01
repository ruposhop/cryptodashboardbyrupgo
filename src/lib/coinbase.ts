import "server-only";
import { createPrivateKey, randomBytes, sign, type KeyObject } from "node:crypto";

const HOST = "api.coinbase.com";

const b64url = (input: Buffer | string) =>
  Buffer.from(input).toString("base64url");

// La CDP key puede ser ECDSA (PEM) o Ed25519 (base64 de 64 bytes: semilla + pública).
function loadKey(): { key: KeyObject; alg: "ES256" | "EdDSA" } {
  const secret = process.env.COINBASE_API_PRIVATE_KEY!.trim();

  if (secret.includes("BEGIN")) {
    return {
      key: createPrivateKey(secret.replace(/\\n/g, "\n")),
      alg: "ES256",
    };
  }
  const seed = Buffer.from(secret, "base64").subarray(0, 32);
  const pkcs8 = Buffer.concat([
    Buffer.from("302e020100300506032b657004220420", "hex"),
    seed,
  ]);
  return {
    key: createPrivateKey({ key: pkcs8, format: "der", type: "pkcs8" }),
    alg: "EdDSA",
  };
}

function buildJwt(method: string, path: string) {
  const keyName = process.env.COINBASE_API_KEY_NAME!.trim();
  const { key, alg } = loadKey();
  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg,
    typ: "JWT",
    kid: keyName,
    nonce: randomBytes(16).toString("hex"),
  };
  const payload = {
    iss: "cdp",
    sub: keyName,
    nbf: now,
    exp: now + 120,
    uri: `${method} ${HOST}${path}`,
  };

  const data = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const signature =
    alg === "ES256"
      ? sign("sha256", Buffer.from(data), { key, dsaEncoding: "ieee-p1363" })
      : sign(null, Buffer.from(data), key);

  return `${data}.${b64url(signature)}`;
}

// Solo GET: la app es de solo lectura.
export async function coinbaseGet<T>(pathWithQuery: string): Promise<T> {
  const path = pathWithQuery.split("?")[0];
  const res = await fetch(`https://${HOST}${pathWithQuery}`, {
    headers: {
      Authorization: `Bearer ${buildJwt("GET", path)}`,
      "CB-VERSION": "2024-01-01",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Coinbase ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}
