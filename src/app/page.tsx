import { LoginForm } from "./login-form";
import { APP_NAME, REPO_URL } from "@/lib/app-config";

export default async function Home({ searchParams }: PageProps<"/">) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 py-12">
      <h1 className="font-mono text-sm tracking-tight">{APP_NAME}</h1>
      <p className="mt-2 text-2xl font-semibold tracking-tight">
        Dashboard privado de una cartera crypto
      </p>
      <p className="mt-2 text-sm leading-6 text-muted">
        Solo lectura: nunca mueve fondos. El acceso es solo para su dueño.
      </p>
      <LoginForm
        initialError={
          error ? "El enlace no es válido o ha caducado." : undefined
        }
      />
      <p className="mt-12 text-xs text-muted">
        Código abierto:{" "}
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-foreground"
        >
          instala el tuyo
        </a>
      </p>
    </main>
  );
}
