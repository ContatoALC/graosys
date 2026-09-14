import { Request, Response } from "express";
import nodemailer from "nodemailer";
import { AppDataSource } from "../../database/data-source";
import { Tenant } from "../entities/Tenant";
import { GrainContract } from "../entities/GrainContract";

export class EmailController {
  private async getTransporter(tenant: Tenant) {
    // Cada tenant pode ter seu SMTP configurado futuramente.
    // Por ora usa as variáveis de ambiente globais.
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendContractEmail(req: Request, res: Response) {
    const { contract_id, copy_correct } = req.body;
    const { tenant_id } = req.user;

    const contractRepo = AppDataSource.getRepository(GrainContract);
    const tenantRepo = AppDataSource.getRepository(Tenant);

    const [contract, tenant] = await Promise.all([
      contractRepo.findOne({ where: { id: contract_id, tenant_id } }),
      tenantRepo.findOne({ where: { id: tenant_id } }),
    ]);

    if (!contract) return res.status(404).json({ error: "Contrato não encontrado" });
    if (!tenant) return res.status(404).json({ error: "Corretora não encontrada" });

    const sellerEmails = contract.list_email_seller || [];
    const buyerEmails = contract.list_email_buyer || [];

    if (sellerEmails.length === 0 && buyerEmails.length === 0) {
      return res.status(400).json({ error: "Nenhum e-mail de vendedor ou comprador cadastrado" });
    }

    const subjectSuffix = copy_correct ? " - (CÓPIA CORRETA)" : "";
    const subject = `Contrato ${contract.number_contract} - ${tenant.name}${subjectSuffix}`;

    const isLocal = process.env.NODE_ENV !== "production";
    const bccList = isLocal
      ? [process.env.SMTP_USER!]
      : [tenant.email].filter(Boolean);

    const transporter = await this.getTransporter(tenant);

    const contractHtml = buildContractHtml(contract, tenant);

    const sentTo: string[] = [];

    if (sellerEmails.length > 0) {
      const sellerNames = Array.isArray(contract.seller) ? contract.seller.join(", ") : contract.seller;
      await transporter.sendMail({
        from: `"${tenant.name}" <${process.env.SMTP_USER}>`,
        to: sellerEmails,
        bcc: bccList,
        subject: `${subject} - Vendedor`,
        html: contractHtml("Vendedor", sellerNames),
      });
      sentTo.push(...sellerEmails);
    }

    if (buyerEmails.length > 0) {
      const buyerNames = Array.isArray(contract.buyer) ? contract.buyer.join(", ") : contract.buyer;
      await transporter.sendMail({
        from: `"${tenant.name}" <${process.env.SMTP_USER}>`,
        to: buyerEmails,
        bcc: bccList,
        subject: `${subject} - Comprador`,
        html: contractHtml("Comprador", buyerNames),
      });
      sentTo.push(...buyerEmails);
    }

    return res.json({
      message: "E-mails enviados com sucesso!",
      sent_to: sentTo,
    });
  }

  async sendCustomEmail(req: Request, res: Response) {
    const { to, subject, body } = req.body;

    if (!to || !subject || !body) {
      return res.status(400).json({ error: "Campos to, subject e body são obrigatórios" });
    }

    const tenantRepo = AppDataSource.getRepository(Tenant);
    const tenant = await tenantRepo.findOne({ where: { id: req.user.tenant_id } });
    if (!tenant) return res.status(404).json({ error: "Corretora não encontrada" });

    const transporter = await this.getTransporter(tenant);

    await transporter.sendMail({
      from: `"${tenant.name}" <${process.env.SMTP_USER}>`,
      to: Array.isArray(to) ? to : [to],
      subject,
      html: body,
    });

    return res.json({ message: "E-mail enviado com sucesso!" });
  }
}

function buildContractHtml(contract: GrainContract, tenant: Tenant) {
  return (role: string, recipientName: string) => `
    <div style="font-family: Arial, sans-serif; color: #1a1a1a; font-size: 14px; line-height: 1.6; max-width: 600px;">
      <div style="background: #f59e0b; padding: 16px 24px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0; color: #1a1a1a; font-size: 18px;">${tenant.name}</h2>
        <p style="margin: 4px 0 0; color: #78350f; font-size: 12px;">Corretora de Grãos</p>
      </div>

      <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <p>Para <strong>${recipientName}</strong>,</p>

        <p>Segue abaixo os detalhes do contrato <strong>${contract.number_contract}</strong> na condição de <strong>${role}</strong>:</p>

        <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px;">
          <tr style="background: #fef3c7;"><td style="padding: 8px 12px; font-weight: bold; border: 1px solid #fde68a;">Nº Contrato</td><td style="padding: 8px 12px; border: 1px solid #fde68a;">${contract.number_contract}</td></tr>
          <tr><td style="padding: 8px 12px; font-weight: bold; border: 1px solid #e5e7eb;">Produto</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${contract.name_product}</td></tr>
          <tr style="background: #f9fafb;"><td style="padding: 8px 12px; font-weight: bold; border: 1px solid #e5e7eb;">Safra</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${contract.crop}</td></tr>
          <tr><td style="padding: 8px 12px; font-weight: bold; border: 1px solid #e5e7eb;">Quantidade</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${contract.quantity} ${contract.type_quantity}</td></tr>
          <tr style="background: #f9fafb;"><td style="padding: 8px 12px; font-weight: bold; border: 1px solid #e5e7eb;">Preço</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${contract.type_currency} ${Number(contract.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} /${contract.type_quantity}</td></tr>
          <tr><td style="padding: 8px 12px; font-weight: bold; border: 1px solid #e5e7eb;">Pagamento</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${contract.payment || "—"}</td></tr>
          <tr style="background: #f9fafb;"><td style="padding: 8px 12px; font-weight: bold; border: 1px solid #e5e7eb;">Retirada</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${contract.pickup_location || "—"}</td></tr>
          <tr><td style="padding: 8px 12px; font-weight: bold; border: 1px solid #e5e7eb;">Período</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${contract.initial_pickup_date || "—"} a ${contract.final_pickup_date || "—"}</td></tr>
          ${contract.observation ? `<tr style="background: #f9fafb;"><td style="padding: 8px 12px; font-weight: bold; border: 1px solid #e5e7eb;">Observação</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${contract.observation}</td></tr>` : ""}
        </table>

        <p>Solicitamos confirmar o recebimento deste e-mail respondendo a esta mensagem.</p>

        <p>Agradecemos a parceria e nos colocamos à disposição.</p>

        <p style="margin-top: 24px;">Atenciosamente,<br/><strong>${tenant.name}</strong></p>
      </div>

      <p style="font-size: 11px; color: #9ca3af; text-align: center; margin-top: 16px;">
        Este e-mail foi enviado automaticamente pelo sistema GraoSys. Por favor, não responda a este endereço caso não seja o destinatário correto.
      </p>
    </div>
  `;
}
