import nodemailer from "nodemailer";
import { EMAIL_LOGO_PNG_BASE64 } from "./emailLogo";
import { LOGO_CID, PlatformEmail, renderPlatformEmail } from "./emailTemplate";

// E-mails da própria plataforma (ex.: redefinição de senha), sempre pelo SMTP global, nunca pelo da corretora.
// Vão com o layout da GraoSys, versão em texto puro e a logo anexada inline (cid), sem depender de imagem externa.
export async function sendPlatformEmail(to: string, subject: string, content: PlatformEmail): Promise<void> {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error("SMTP global não configurado (SMTP_USER/SMTP_PASS).");
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  const from = process.env.SMTP_FROM || `"GraoSys" <${process.env.SMTP_USER}>`;
  const { html, text } = renderPlatformEmail(content);
  await transporter.sendMail({
    from, to, subject, html, text,
    attachments: [{ filename: "graosys.png", content: Buffer.from(EMAIL_LOGO_PNG_BASE64, "base64"), cid: LOGO_CID, contentType: "image/png" }],
  });
}
