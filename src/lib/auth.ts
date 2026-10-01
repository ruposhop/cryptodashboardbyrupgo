export function isAllowedEmail(email: string | null | undefined) {
  const allowed = process.env.ALLOWED_EMAIL?.trim().toLowerCase();
  return !!allowed && email?.trim().toLowerCase() === allowed;
}
