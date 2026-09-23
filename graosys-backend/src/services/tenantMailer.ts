import nodemailer from "nodemailer";
import { AppDataSource } from "../database/data-source";
import { Tenant } from "../app/entities/Tenant";
import { TenantEmailSettings } from "../app/entities/TenantEmailSettings";
import { decryptSecret } from "../utils/crypto";

export interface TenantMailer {
  transporter: nodemailer.Transporter;
  from: string;
  bcc: string[];
  signature: string | null;
}

// Usa o SMTP cadastrado pela corretora; sem cadastro, cai nas variáveis globais.
export async function getTenantMailer(tenant: Tenant): Promise<TenantMailer> {
  const settings = await AppDataSource.getRepository(TenantEmailSettings).findOne({
    where: { tenant_id: tenant.id, active: true },
  });

  if (settings) {
    const transporter = nodemailer.createTransport({
      host: settings.smtp_host,
      port: settings.smtp_port,
      secure: settings.smtp_secure,
      auth: { user: settings.smtp_user, pass: decryptSecret(settings.smtp_pass_encrypted) },
    });
    const fromEmail = settings.from_email || settings.smtp_user;
    return {
      transporter,
      from: `"${settings.from_name || tenant.name}" <${fromEmail}>`,
      bcc: settings.bcc_emails || [],
      signature: settings.signature || null,
    };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return {
    transporter,
    from: `"${tenant.name}" <${process.env.SMTP_USER}>`,
    bcc: [tenant.email].filter(Boolean),
    signature: null,
  };
}
