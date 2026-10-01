import { confirmMagicLink } from "../../actions";
import { ConfirmButton } from "./confirm-button";
import { APP_NAME } from "@/lib/app-config";

// El enlace no inicia sesión solo: hace falta pulsar el botón. Así los
// escáneres de enlaces del correo no gastan el token de un solo uso.
export default async function Confirm({
  searchParams,
}: PageProps<"/auth/confirm">) {
  const { token_hash } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 py-12">
      <h1 className="font-mono text-sm tracking-tight">{APP_NAME}</h1>
      <p className="mt-2 text-2xl font-semibold tracking-tight">
        Confirmar acceso
      </p>
      <form action={confirmMagicLink} className="mt-8">
        <input
          type="hidden"
          name="token_hash"
          value={typeof token_hash === "string" ? token_hash : ""}
        />
        <ConfirmButton />
      </form>
    </main>
  );
}
