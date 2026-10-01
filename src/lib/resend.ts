import "server-only";
import { Resend } from "resend";
import { EMAIL_FROM } from "@/lib/app-config";

const FROM = EMAIL_FROM;

export async function sendEmail(to: string, subject: string, html: string) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({ from: FROM, to, subject, html });
  if (error) throw new Error(error.message);
}
