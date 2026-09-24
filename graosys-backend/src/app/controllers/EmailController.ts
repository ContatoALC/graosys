import { Request, Response } from "express";
import sanitizeHtml from "sanitize-html";
import { AppDataSource } from "../../database/data-source";
import { Tenant } from "../entities/Tenant";
import { GrainContract } from "../entities/GrainContract";
import { getTenantMailer } from "../../services/tenantMailer";
import { generateContractPdf, getPdfSettings } from "../../services/contractPdf";

function safeFile(v: string): string {
  return String(v).replace(/[^\w.-]+/g, "_");
}

function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const EMAIL_BODY_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "h1", "h2", "h3", "h4",
    "table", "thead", "tbody", "tr", "td", "th", "span", "div", "a", "hr", "blockquote",
  ],
  allowedAttributes: {
    a: ["href", "title", "target"],
    "*": ["style"],
  },
  allowedSchemes: ["http", "https", "mailto"],
};

export class EmailController {
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
    const mailer = await getTenantMailer(tenant);
    const bccList = isLocal ? [process.env.SMTP_USER!].filter(Boolean) : mailer.bcc;
    const transporter = mailer.transporter;
    const layout = await getPdfSettings(tenant_id);

    const contractHtml = buildContractHtml(contract, tenant);

    const sentTo: string[] = [];

    if (sellerEmails.length > 0) {
      const sellerNames = Array.isArray(contract.seller) ? contract.seller.join(", ") : contract.seller;
      await transporter.sendMail({
        from: mailer.from,
        to: sellerEmails,
        bcc: bccList,
        subject: `${subject} - Vendedor`,
        html: contractHtml("Vendedor", sellerNames, mailer.signature),
        attachments: [{ filename: `contrato_${safeFile(contract.number_contract)}_vendedor.pdf`, content: await generateContractPdf(contract, tenant, "Vendedor", layout) }],
      });
      sentTo.push(...sellerEmails);
    }

    if (buyerEmails.length > 0) {
      const buyerNames = Array.isArray(contract.buyer) ? contract.buyer.join(", ") : contract.buyer;
      await transporter.sendMail({
        from: mailer.from,
        to: buyerEmails,
        bcc: bccList,
        subject: `${subject} - Comprador`,
        html: contractHtml("Comprador", buyerNames, mailer.signature),
        attachments: [{ filename: `contrato_${safeFile(contract.number_contract)}_comprador.pdf`, content: await generateContractPdf(contract, tenant, "Comprador", layout) }],
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

    const mailer = await getTenantMailer(tenant);
    const safeBody = sanitizeHtml(body, EMAIL_BODY_SANITIZE_OPTIONS);

    await mailer.transporter.sendMail({
      from: mailer.from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html: safeBody,
    });

    return res.json({ message: "E-mail enviado com sucesso!" });
  }
}

function buildContractHtml(contract: GrainContract, tenant: Tenant) {
  return (role: string, recipientName: string, signature?: string | null) => {
    const tenantName = escapeHtml(tenant.name);
    const numberContract = escapeHtml(contract.number_contract);
    const nameProduct = escapeHtml(contract.name_product);
    const crop = escapeHtml(contract.crop);
    const typeQuantity = escapeHtml(contract.type_quantity);
    const typeCurrency = escapeHtml(contract.type_currency);
    const payment = escapeHtml(contract.payment || "—");
    const pickupLocation = escapeHtml(contract.pickup_location || "—");
    const initialPickupDate = escapeHtml(contract.initial_pickup_date || "—");
    const finalPickupDate = escapeHtml(contract.final_pickup_date || "—");
    const observation = escapeHtml(contract.observation);
    const safeRole = escapeHtml(role);
    const safeRecipientName = escapeHtml(recipientName);

    return `
    <div style="font-family: Arial, sans-serif; color: #1a1a1a; font-size: 14px; line-height: 1.6; max-width: 600px;">
      <div style="background: #f59e0b; padding: 16px 24px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0; color: #1a1a1a; font-size: 18px;">${tenantName}</h2>
        <p style="margin: 4px 0 0; color: #78350f; font-size: 12px;">Corretora de Grãos</p>
      </div>

      <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <p>Para <strong>${safeRecipientName}</strong>,</p>

        <p>Segue abaixo os detalhes do contrato <strong>${numberContract}</strong> na condição de <strong>${safeRole}</strong>:</p>

        <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px;">
          <tr style="background: #fef3c7;"><td style="padding: 8px 12px; font-weight: bold; border: 1px solid #fde68a;">Nº Contrato</td><td style="padding: 8px 12px; border: 1px solid #fde68a;">${numberContract}</td></tr>
          <tr><td style="padding: 8px 12px; font-weight: bold; border: 1px solid #e5e7eb;">Produto</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${nameProduct}</td></tr>
          <tr style="background: #f9fafb;"><td style="padding: 8px 12px; font-weight: bold; border: 1px solid #e5e7eb;">Safra</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${crop}</td></tr>
          <tr><td style="padding: 8px 12px; font-weight: bold; border: 1px solid #e5e7eb;">Quantidade</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${contract.quantity} ${typeQuantity}</td></tr>
          <tr style="background: #f9fafb;"><td style="padding: 8px 12px; font-weight: bold; border: 1px solid #e5e7eb;">Preço</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${typeCurrency} ${Number(contract.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} /${typeQuantity}</td></tr>
          <tr><td style="padding: 8px 12px; font-weight: bold; border: 1px solid #e5e7eb;">Pagamento</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${payment}</td></tr>
          <tr style="background: #f9fafb;"><td style="padding: 8px 12px; font-weight: bold; border: 1px solid #e5e7eb;">Retirada</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${pickupLocation}</td></tr>
          <tr><td style="padding: 8px 12px; font-weight: bold; border: 1px solid #e5e7eb;">Período</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${initialPickupDate} a ${finalPickupDate}</td></tr>
          ${contract.observation ? `<tr style="background: #f9fafb;"><td style="padding: 8px 12px; font-weight: bold; border: 1px solid #e5e7eb;">Observação</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${observation}</td></tr>` : ""}
        </table>

        <p>Solicitamos confirmar o recebimento deste e-mail respondendo a esta mensagem.</p>

        <p>O contrato segue em anexo (PDF). Agradecemos a parceria e nos colocamos à disposição.</p>

        <p style="margin-top: 24px;">Atenciosamente,<br/><strong>${tenantName}</strong>${signature ? `<br/>${escapeHtml(signature).replace(/\n/g, "<br/>")}` : ""}</p>
      </div>

      <p style="font-size: 11px; color: #9ca3af; text-align: center; margin-top: 16px;">
        Este e-mail foi enviado automaticamente pelo sistema GraoSys. Por favor, não responda a este endereço caso não seja o destinatário correto.
      </p>
    </div>
  `;
  };
}
