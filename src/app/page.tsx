import { LoginForm } from "./login-form";
import { APP_NAME } from "@/lib/app-config";

export default async function Home({ searchParams }: PageProps<"/">) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 py-12">
      <h1 className="font-mono text-sm tracking-tight">{APP_NAME}</h1>
      <p className="mt-2 text-2xl font-semibold tracking-tight">
        Acceso privado
      </p>
      <LoginForm
        initialError={
          error ? "El enlace no es válido o ha caducado." : undefined
        }
      />
    </main>
  );
}
