import { Request, Response } from "express";
import sanitizeHtml from "sanitize-html";
import { AppDataSource } from "../../database/data-source";
import { Tenant } from "../entities/Tenant";
import { GrainContract } from "../entities/GrainContract";
import { ContractEmailLog } from "../entities/ContractEmailLog";
import { getTenantMailer } from "../../services/tenantMailer";
import { afterSent, sendBlockedReason } from "../../services/contractWorkflow";
import { contractPdfFilename, generateContractPdf, getPdfFixations, roleLabel } from "../../services/contractPdf";
import { TemplateLanguage, resolveContractTemplate } from "../../services/contractTemplates";

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

    // Assunto, corpo e PDF seguem o idioma do modelo do contrato.
    const { template, resolved } = await resolveContractTemplate(tenant_id, contract);
    const lang = resolved.language;
    const t = EMAIL_TEXTS[lang];
    const subject = `${t.contract} ${contract.number_contract} - ${tenant.name}${copy_correct ? t.copyCorrect : ""}`;

    const isLocal = process.env.NODE_ENV !== "production";
    const mailer = await getTenantMailer(tenant);
    const bccList = isLocal ? [process.env.SMTP_USER!].filter(Boolean) : mailer.bcc;
    const transporter = mailer.transporter;
    const fixations = await getPdfFixations(tenant_id, contract);

    const contractHtml = buildContractHtml(contract, tenant, lang);

    const logRepo = AppDataSource.getRepository(ContractEmailLog);
    const parties = [
      { party: "seller", role: "Vendedor" as const, emails: sellerEmails, names: contract.seller },
      { party: "buyer", role: "Comprador" as const, emails: buyerEmails, names: contract.buyer },
    ].filter((p) => p.emails.length > 0);

    const sentTo: string[] = [];
    const results: { party: string; status: string }[] = [];

    for (const p of parties) {
      const names = Array.isArray(p.names) ? p.names.join(", ") : String(p.names || "");
      const partySubject = `${subject} - ${roleLabel(p.role, lang)}`;
      let status = "sent";
      let error: string | null = null;
      try {
        await transporter.sendMail({
          from: mailer.from,
          to: p.emails,
          bcc: bccList,
          subject: partySubject,
          html: contractHtml(roleLabel(p.role, lang), names, mailer.signature),
          attachments: [{ filename: contractPdfFilename(contract, p.role, lang), content: await generateContractPdf(contract, tenant, p.role, resolved, fixations) }],
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

    // Alguma parte recebeu: fixa o modelo no contrato e congela o texto enviado (o PDF passa a mostrar esta versão).
    if (results.some((r) => r.status === "sent")) {
      const { logo_data: _l, logo_position: _p, logo_width: _w, watermark_data: _wd, watermark_opacity: _wo, watermark_enabled: _we, ...content } = resolved;
      await contractRepo.update({ id: contract.id, tenant_id }, { template_id: template.id, template_snapshot: { ...content, sent_at: new Date().toISOString() } as any });
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

const EMAIL_TEXTS = {
  "pt-BR": {
    contract: "Contrato", copyCorrect: " - (CÓPIA CORRETA)", brokerage: "Corretora de Grãos", to: "Para",
    intro: (n: string, r: string) => `Segue abaixo os detalhes do contrato <strong>${n}</strong> na condição de <strong>${r}</strong>:`,
    number: "Nº Contrato", product: "Produto", crop: "Safra", quantity: "Quantidade", price: "Preço", payment: "Pagamento",
    pickup: "Retirada", period: "Período", periodTo: "a", observation: "Observação",
    confirm: "Solicitamos confirmar o recebimento deste e-mail respondendo a esta mensagem.",
    attached: "O contrato segue em anexo (PDF). Agradecemos a parceria e nos colocamos à disposição.",
    regards: "Atenciosamente,",
    footer: "${t.footer}",
    locale: "pt-BR",
  },
  en: {
    contract: "Contract", copyCorrect: " - (CORRECTED COPY)", brokerage: "Grain Brokerage", to: "To",
    intro: (n: string, r: string) => `Please find below the details of contract <strong>${n}</strong> as <strong>${r}</strong>:`,
    number: "Contract No.", product: "Product", crop: "Crop", quantity: "Quantity", price: "Price", payment: "Payment",
    pickup: "Pickup", period: "Period", periodTo: "to", observation: "Remarks",
    confirm: "Please confirm receipt of this e-mail by replying to this message.",
    attached: "The contract is attached (PDF). Thank you for your business; we remain at your disposal.",
    regards: "Best regards,",
    footer: "This e-mail was sent automatically by GraoSys. If you are not the intended recipient, please disregard it.",
    locale: "en-US",
  },
};

function buildContractHtml(contract: GrainContract, tenant: Tenant, lang: TemplateLanguage = "pt-BR") {
  const t = EMAIL_TEXTS[lang];
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
        <p style="margin: 4px 0 0; color: #78350f; font-size: 12px;">${t.brokerage}</p>
      </div>

      <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <p>${t.to} <strong>${safeRecipientName}</strong>,</p>

        <p>${t.intro(numberContract, safeRole)}</p>

        <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px;">
          <tr style="background: #fef3c7;"><td style="padding: 8px 12px; font-weight: bold; border: 1px solid #fde68a;">${t.number}</td><td style="padding: 8px 12px; border: 1px solid #fde68a;">${numberContract}</td></tr>
          <tr><td style="padding: 8px 12px; font-weight: bold; border: 1px solid #e5e7eb;">${t.product}</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${nameProduct}</td></tr>
          <tr style="background: #f9fafb;"><td style="padding: 8px 12px; font-weight: bold; border: 1px solid #e5e7eb;">${t.crop}</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${crop}</td></tr>
          <tr><td style="padding: 8px 12px; font-weight: bold; border: 1px solid #e5e7eb;">${t.quantity}</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${contract.quantity} ${typeQuantity}</td></tr>
          <tr style="background: #f9fafb;"><td style="padding: 8px 12px; font-weight: bold; border: 1px solid #e5e7eb;">${t.price}</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${typeCurrency} ${Number(contract.price).toLocaleString(t.locale, { minimumFractionDigits: 2 })} /${typeQuantity}</td></tr>
          <tr><td style="padding: 8px 12px; font-weight: bold; border: 1px solid #e5e7eb;">${t.payment}</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${payment}</td></tr>
          <tr style="background: #f9fafb;"><td style="padding: 8px 12px; font-weight: bold; border: 1px solid #e5e7eb;">${t.pickup}</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${pickupLocation}</td></tr>
          <tr><td style="padding: 8px 12px; font-weight: bold; border: 1px solid #e5e7eb;">${t.period}</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${initialPickupDate} ${t.periodTo} ${finalPickupDate}</td></tr>
          ${contract.observation ? `<tr style="background: #f9fafb;"><td style="padding: 8px 12px; font-weight: bold; border: 1px solid #e5e7eb;">${t.observation}</td><td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${observation}</td></tr>` : ""}
        </table>

        <p>${t.confirm}</p>

        <p>${t.attached}</p>

        <p style="margin-top: 24px;">${t.regards}<br/><strong>${tenantName}</strong>${signature ? `<br/>${escapeHtml(signature).replace(/\n/g, "<br/>")}` : ""}</p>
      </div>

      <p style="font-size: 11px; color: #9ca3af; text-align: center; margin-top: 16px;">
        ${t.footer}
      </p>
    </div>
  `;
  };
}
