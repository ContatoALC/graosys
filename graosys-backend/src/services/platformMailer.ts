import nodemailer from "nodemailer";

// E-mails da própria plataforma (ex.: redefinição de senha), sempre pelo SMTP global, nunca pelo da corretora.
export async function sendPlatformEmail(to: string, subject: string, html: string): Promise<void> {
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
  await transporter.sendMail({ from, to, subject, html });
}
