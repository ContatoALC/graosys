import { Request, Response } from "express";
import { AppDataSource } from "../../database/data-source";
import { TenantEmailSettings } from "../entities/TenantEmailSettings";
import { Tenant } from "../entities/Tenant";
import { encryptSecret } from "../../utils/crypto";
import { getTenantMailer } from "../../services/tenantMailer";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toPublic(s: TenantEmailSettings) {
  const { smtp_pass_encrypted, ...rest } = s;
  return { ...rest, has_password: Boolean(smtp_pass_encrypted) };
}

export class EmailSettingsController {
  async get(req: Request, res: Response) {
    const s = await AppDataSource.getRepository(TenantEmailSettings).findOne({ where: { tenant_id: req.user.tenant_id } });
    return res.json(s ? toPublic(s) : null);
  }

  async save(req: Request, res: Response) {
    const { smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, from_name, from_email, bcc_emails, signature, active } = req.body;
    const repo = AppDataSource.getRepository(TenantEmailSettings);
    let s = await repo.findOne({ where: { tenant_id: req.user.tenant_id } });

    if (!smtp_host || !smtp_user) return res.status(400).json({ error: "Servidor SMTP e usuário são obrigatórios" });
    if (!s && !smtp_pass) return res.status(400).json({ error: "Senha SMTP é obrigatória" });
    if (from_email && !EMAIL_RE.test(from_email)) return res.status(400).json({ error: "E-mail do remetente inválido" });

    const bcc = Array.isArray(bcc_emails) ? bcc_emails.map((e: string) => String(e).trim()).filter(Boolean) : [];
    if (bcc.some((e: string) => !EMAIL_RE.test(e))) return res.status(400).json({ error: "Lista de cópia oculta contém e-mail inválido" });

    if (!s) s = repo.create({ tenant_id: req.user.tenant_id });
    Object.assign(s, {
      smtp_host,
      smtp_port: Number(smtp_port) || 587,
      smtp_secure: Boolean(smtp_secure),
      smtp_user,
      from_name: from_name || null,
      from_email: from_email || null,
      bcc_emails: bcc,
      signature: signature || null,
      active: active === undefined ? true : Boolean(active),
    });
    if (smtp_pass) s.smtp_pass_encrypted = encryptSecret(smtp_pass);

    await repo.save(s);
    return res.json(toPublic(s));
  }

  async test(req: Request, res: Response) {
    const tenant = await AppDataSource.getRepository(Tenant).findOne({ where: { id: req.user.tenant_id } });
    if (!tenant) return res.status(404).json({ error: "Corretora não encontrada" });
    const mailer = await getTenantMailer(tenant);
    try {
      await mailer.transporter.sendMail({
        from: mailer.from,
        to: req.user.email,
        subject: `Teste de e-mail - ${tenant.name}`,
        text: "Se você recebeu esta mensagem, a configuração de e-mail está funcionando.",
      });
    } catch (e: any) {
      return res.status(400).json({ error: `Falha ao enviar: ${e.message}` });
    }
    return res.json({ message: `E-mail de teste enviado para ${req.user.email}` });
  }
}
