import { Request, Response } from "express";
import sanitizeHtml from "sanitize-html";
import { AppDataSource } from "../../database/data-source";
import { Tenant } from "../entities/Tenant";
import { GrainContract } from "../entities/GrainContract";
import { ContractEmailLog } from "../entities/ContractEmailLog";
import { getTenantMailer } from "../../services/tenantMailer";
import { afterSent, sendBlockedReason } from "../../services/contractWorkflow";
import { contractPdfFilename, generateContractPdf, getPdfFixations, getPdfSettings } from "../../services/contractPdf";

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

const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;
const MAX_RECIPIENTS = 20;

// Limpa uma lista de destinatários: tira espaços, põe em minúsculas e remove repetidos.
// Devolve o primeiro endereço inválido em "invalid" para a mensagem de erro.
function cleanRecipients(raw: unknown): { list: string[]; invalid?: string } {
  if (raw === undefined || raw === null) return { list: [] };
  if (!Array.isArray(raw)) return { list: [], invalid: String(raw) };
  const list: string[] = [];
  for (const item of raw) {
    const email = String(item ?? "").trim().toLowerCase();
    if (!email) continue;
    if (!EMAIL_RE.test(email) || email.length > 254) return { list: [], invalid: email };
    if (!list.includes(email)) list.push(email);
  }
  return { list };
}

export class EmailController {
  // Grupos de e-mail do vendedor e do comprador, gravados no contrato pela tela de envio
  // (a parte não precisa estar no cadastro de clientes).
  async saveRecipients(req: Request, res: Response) {
    const repo = AppDataSource.getRepository(GrainContract);
    const contract = await repo.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });
    if (!contract) return res.status(404).json({ error: "Contrato não encontrado" });

    const seller = cleanRecipients(req.body?.seller);
    const buyer = cleanRecipients(req.body?.buyer);
    const invalid = seller.invalid ?? buyer.invalid;
    if (invalid !== undefined) return res.status(400).json({ error: `E-mail inválido: ${invalid.slice(0, 80)}` });
    if (seller.list.length > MAX_RECIPIENTS || buyer.list.length > MAX_RECIPIENTS) {
      return res.status(400).json({ error: `Informe no máximo ${MAX_RECIPIENTS} e-mails por parte` });
    }

    contract.list_email_seller = seller.list;
    contract.list_email_buyer = buyer.list;
    await repo.save(contract);
    return res.json({ list_email_seller: seller.list, list_email_buyer: buyer.list });
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
    const blocked = sendBlockedReason(contract);
    if (blocked) return res.status(409).json({ error: blocked });

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
    const fixations = await getPdfFixations(tenant_id, contract);

    const contractHtml = buildContractHtml(contract, tenant);

    const logRepo = AppDataSource.getRepository(ContractEmailLog);
    const parties = [
      { party: "seller", role: "Vendedor" as const, emails: sellerEmails, names: contract.seller },
      { party: "buyer", role: "Comprador" as const, emails: buyerEmails, names: contract.buyer },
    ].filter((p) => p.emails.length > 0);

    const sentTo: string[] = [];
    const results: { party: string; status: string }[] = [];

    for (const p of parties) {
      const names = Array.isArray(p.names) ? p.names.join(", ") : String(p.names || "");
      const partySubject = `${subject} - ${p.role}`;
      let status = "sent";
      let error: string | null = null;
      try {
        await transporter.sendMail({
          from: mailer.from,
          to: p.emails,
          bcc: bccList,
          subject: partySubject,
          html: contractHtml(p.role, names, mailer.signature),
          attachments: [{ filename: contractPdfFilename(contract, p.role), content: await generateContractPdf(contract, tenant, p.role, layout, fixations) }],
        });
        sentTo.push(...p.emails);
      } catch (e: any) {
        status = "failed";
        error = String(e?.message || e).slice(0, 500);
      }
      await logRepo.save(
        logRepo.create({
          tenant_id,
          contract_id: contract.id,
          party: p.party,
          party_names: names,
          recipients: p.emails,
          subject: partySubject,
          copy_correct: Boolean(copy_correct),
          status,
          error,
          sent_by_id: req.user.id,
          sent_by_name: req.user.name,
          sent_by_email: req.user.email,
        })
      );
      results.push({ party: p.party, status });
    }

    const failed = results.filter((r) => r.status === "failed");
    if (failed.length > 0) {
      const who = failed.map((f) => (f.party === "seller" ? "vendedor" : "comprador")).join(" e ");
      return res.status(502).json({ error: `Falha ao enviar o e-mail para o ${who}. Verifique a configuração de e-mail da corretora.`, results, sent_to: sentTo });
    }

    // Enviado a todas as partes: o contrato sai da Execução.
    if (afterSent(contract, req.user.name)) await contractRepo.update({ id: contract.id, tenant_id }, { status: contract.status });

    return res.json({ message: "E-mails enviados com sucesso!", sent_to: sentTo, results });
  }

  // Histórico de envios de um contrato (somente da corretora do usuário).
  async logs(req: Request, res: Response) {
    const { tenant_id } = req.user;
    const contract = await AppDataSource.getRepository(GrainContract).findOne({ where: { id: req.params.id, tenant_id }, select: ["id"] });
    if (!contract) return res.status(404).json({ error: "Contrato não encontrado" });
    const logs = await AppDataSource.getRepository(ContractEmailLog).find({
      where: { tenant_id, contract_id: contract.id },
      order: { sent_at: "DESC" },
    });
    return res.json(logs);
  }

  // Último envio bem-sucedido por contrato e lado, para a listagem da Execução.
  async summary(req: Request, res: Response) {
    const rows = await AppDataSource.getRepository(ContractEmailLog)
      .createQueryBuilder("l")
      .select("l.contract_id", "contract_id")
      .addSelect("l.party", "party")
      .addSelect("MAX(l.sent_at)", "last_sent_at")
      .where("l.tenant_id = :tenant_id AND l.status = 'sent'", { tenant_id: req.user.tenant_id })
      .groupBy("l.contract_id")
      .addGroupBy("l.party")
      .getRawMany();
    const out: Record<string, { seller?: string; buyer?: string }> = {};
    for (const r of rows) (out[r.contract_id] ||= {})[r.party as "seller" | "buyer"] = r.last_sent_at;
    return res.json(out);
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
