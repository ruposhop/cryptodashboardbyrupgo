import { APP_NAME } from "@/lib/app-config";

// Plantilla base de todos los emails del proyecto (mismo look que la app).
export function emailTemplate(title: string, bodyHtml: string) {
  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:32px 16px;background:#0a0b0d;color:#e8eaed;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <div style="max-width:440px;margin:0 auto;background:#121418;border:1px solid #23262d;border-radius:12px;padding:28px;">
      <p style="margin:0;font-family:ui-monospace,Menlo,monospace;font-size:13px;color:#8b919c;">${APP_NAME}</p>
      <h1 style="margin:12px 0 16px;font-size:20px;font-weight:600;color:#e8eaed;">${title}</h1>
      <div style="font-size:14px;line-height:22px;color:#e8eaed;">${bodyHtml}</div>
    </div>
    <p style="max-width:440px;margin:16px auto 0;font-size:12px;color:#8b919c;text-align:center;">Dashboard privado · solo lectura</p>
  </body>
</html>`;
}

export function emailButton(href: string, label: string) {
  return `<a href="${href}" style="display:inline-block;margin:8px 0;padding:12px 20px;background:#e8eaed;color:#0a0b0d;border-radius:8px;font-weight:600;text-decoration:none;">${label}</a>`;
}
