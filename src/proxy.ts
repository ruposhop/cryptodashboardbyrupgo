import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAllowedEmail } from "@/lib/auth";

// Todo es privado salvo el login ("/"), la confirmación del magic link y los
// archivos que el móvil necesita para instalar la app (manifest e iconos).
const PUBLIC_PATHS = ["/", "/auth/confirm", "/manifest.webmanifest", "/icon.svg", "/apple-icon"];

export async function proxy(request: NextRequest) {
  // Las rutas del cron no usan sesión: se protegen con CRON_SECRET.
  if (request.nextUrl.pathname.startsWith("/api/cron/")) {
    const secret = process.env.CRON_SECRET;
    const ok =
      !!secret && request.headers.get("authorization") === `Bearer ${secret}`;
    return ok
      ? NextResponse.next({ request })
      : NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const hasAccess = isAllowedEmail(user?.email);
  const { pathname } = request.nextUrl;

  if (!hasAccess && !PUBLIC_PATHS.includes(pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (hasAccess && pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
