import { Request, Response } from "express";
import { Not } from "typeorm";
import { AppDataSource } from "../../database/data-source";
import { Tenant } from "../entities/Tenant";
import { GrainContract } from "../entities/GrainContract";
import { ContractTemplate } from "../entities/ContractTemplate";
import { generateContractPdf, getPdfFixations } from "../../services/contractPdf";
import {
  FIELD_LABELS, LANGUAGES, MAX_CLAUSES, MAX_CLAUSE_BODY, TEXTS, TemplateLanguage, TemplateVisual, VARIABLES,
  contentOf, defaultContent, ensureDefaultTemplate, normalizeContent, visualOf,
} from "../../services/contractTemplates";

const MAX_IMAGE_BYTES = 300 * 1024;
const POSITIONS = ["left", "center", "right"];
const DATA_URI_RE = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/;

// Valida data URI: tipo, tamanho e assinatura real do arquivo (não confia só no prefixo).
function validateImage(value: string): string | null {
  const m = DATA_URI_RE.exec(value);
  if (!m) return "Imagem deve ser PNG ou JPEG";
  const buf = Buffer.from(m[2], "base64");
  if (buf.length > MAX_IMAGE_BYTES) return "Imagem excede 300 KB";
  const isPng = m[1] === "png" && buf.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const isJpg = m[1] === "jpeg" && buf.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  return isPng || isJpg ? null : "Arquivo de imagem inválido";
}

// Visual do PDF vindo da tela. Imagens: string = substitui, null = remove, ausente = mantém.
function normalizeVisual(body: any, base: TemplateVisual): { visual?: TemplateVisual; error?: string } {
  const v = { ...base };
  for (const field of ["logo_data", "watermark_data"] as const) {
    const value = body[field];
    if (value === undefined) continue;
    if (value === null) { v[field] = null; continue; }
    const err = typeof value === "string" ? validateImage(value) : "Imagem inválida";
    if (err) return { error: err };
    v[field] = value;
  }
  if (body.logo_position !== undefined) {
    if (!POSITIONS.includes(body.logo_position)) return { error: "Posição do logo inválida" };
    v.logo_position = body.logo_position;
  }
  if (body.logo_width !== undefined) v.logo_width = Math.min(Math.max(Number(body.logo_width) || 120, 40), 300);
  if (body.watermark_opacity !== undefined) v.watermark_opacity = Math.min(Math.max(Number(body.watermark_opacity) || 0.1, 0.03), 0.5);
  if (body.watermark_enabled !== undefined) v.watermark_enabled = Boolean(body.watermark_enabled);
  v.watermark_enabled = v.watermark_enabled && Boolean(v.watermark_data);
  return { visual: v };
}

async function nameTaken(tenantId: string, name: string, exceptId?: string) {
  const rows = await AppDataSource.getRepository(ContractTemplate).createQueryBuilder("t")
    .where("t.tenant_id = :tenantId AND LOWER(TRIM(t.name)) = LOWER(:name)", { tenantId, name: name.trim() })
    .andWhere(exceptId ? "t.id <> :exceptId" : "1=1", { exceptId })
    .getCount();
  return rows > 0;
}

// Contrato de exemplo da prévia (datas no formato do banco).
const SAMPLE_CONTRACT: any = {
  number_contract: "EXEMPLO-0001", seller: ["Vendedor de Exemplo"], buyer: ["Comprador de Exemplo"],
  name_product: "Soja em grãos", crop: "2025/2026", quality: "Umidade 14%", type_quantity: "sc",
  quantity: 12500, type_currency: "BRL", price: 132.5, price_type: "fixed", payment: "30 dias após retirada",
  pickup_location: "Rio Verde/GO", initial_pickup_date: "2026-10-01", final_pickup_date: "2026-10-30",
  destination: "Porto de Paranaguá/PR", contract_emission_date: "2026-09-15",
  commission_seller: "0,5", type_commission_seller: "%", commission_seller_contract_value: 8281.25,
};

export class ContractTemplateController {
  // Lista enxuta: alimenta a tela de modelos e o seletor do contrato.
  async list(req: Request, res: Response) {
    await ensureDefaultTemplate(req.user.tenant_id);
    const rows = await AppDataSource.getRepository(ContractTemplate).find({
      where: { tenant_id: req.user.tenant_id },
      select: ["id", "name", "language", "is_default", "active", "updated_at"],
      order: { is_default: "DESC", name: "ASC" },
    });
    return res.json(rows);
  }

  // Campos, variáveis e limites para o editor.
  async catalog(_req: Request, res: Response) {
    return res.json({
      fields: Object.entries(FIELD_LABELS).map(([key, labels]) => ({ key, labels })),
      variables: Object.entries(VARIABLES).map(([key, label]) => ({ key, label })),
      defaults: Object.fromEntries(LANGUAGES.map((l) => [l, { title: TEXTS[l].title, closing_text: TEXTS[l].closing, signatures: TEXTS[l].signatures }])),
      limits: { clauses: MAX_CLAUSES, clause_body: MAX_CLAUSE_BODY },
    });
  }

  async get(req: Request, res: Response) {
    const t = await AppDataSource.getRepository(ContractTemplate).findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });
    if (!t) return res.status(404).json({ error: "Modelo não encontrado" });
    const used = await AppDataSource.getRepository(GrainContract).count({ where: { tenant_id: req.user.tenant_id, template_id: t.id } });
    return res.json({ ...t, contracts_count: used });
  }

  // Modelo novo: textos padrão do idioma escolhido e o visual do modelo padrão da corretora.
  async create(req: Request, res: Response) {
    const { tenant_id } = req.user;
    const name = typeof req.body?.name === "string" ? req.body.name.trim().slice(0, 80) : "";
    if (!name) return res.status(400).json({ error: "Informe o nome do modelo" });
    const language: TemplateLanguage = LANGUAGES.includes(req.body?.language) ? req.body.language : "pt-BR";
    if (await nameTaken(tenant_id, name)) return res.status(400).json({ error: "Já existe um modelo com esse nome" });
    const base = await ensureDefaultTemplate(tenant_id);
    const repo = AppDataSource.getRepository(ContractTemplate);
    const t = await repo.save(repo.create({ tenant_id, name, is_default: false, active: true, ...defaultContent(language), ...visualOf(base) }));
    return res.status(201).json(t);
  }

  async update(req: Request, res: Response) {
    const { tenant_id } = req.user;
    const repo = AppDataSource.getRepository(ContractTemplate);
    const t = await repo.findOne({ where: { id: req.params.id, tenant_id } });
    if (!t) return res.status(404).json({ error: "Modelo não encontrado" });
    const body = req.body ?? {};

    if (body.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
      if (!name) return res.status(400).json({ error: "Informe o nome do modelo" });
      if (await nameTaken(tenant_id, name, t.id)) return res.status(400).json({ error: "Já existe um modelo com esse nome" });
      t.name = name;
    }
    if (body.active !== undefined) {
      if (!body.active && t.is_default) return res.status(400).json({ error: "O modelo padrão não pode ser arquivado" });
      t.active = Boolean(body.active);
    }
    const { content, error } = normalizeContent(body, contentOf(t));
    if (error || !content) return res.status(400).json({ error });
    const v = normalizeVisual(body, visualOf(t));
    if (v.error || !v.visual) return res.status(400).json({ error: v.error });
    const { template_id: _id, name: _name, ...fields } = content;
    Object.assign(t, fields, v.visual);
    await repo.save(t);
    return res.json(t);
  }

  async duplicate(req: Request, res: Response) {
    const { tenant_id } = req.user;
    const repo = AppDataSource.getRepository(ContractTemplate);
    const source = await repo.findOne({ where: { id: req.params.id, tenant_id } });
    if (!source) return res.status(404).json({ error: "Modelo não encontrado" });
    let name = `${source.name} (cópia)`.slice(0, 80);
    for (let i = 2; await nameTaken(tenant_id, name); i++) name = `${source.name} (cópia ${i})`.slice(0, 80);
    const { id: _id, created_at: _c, updated_at: _u, ...rest } = source;
    const copy = await repo.save(repo.create({ ...rest, name, is_default: false, active: true }));
    return res.status(201).json(copy);
  }

  async setDefault(req: Request, res: Response) {
    const { tenant_id } = req.user;
    const t = await AppDataSource.getRepository(ContractTemplate).findOne({ where: { id: req.params.id, tenant_id } });
    if (!t) return res.status(404).json({ error: "Modelo não encontrado" });
    if (!t.active) return res.status(400).json({ error: "Reative o modelo antes de torná-lo padrão" });
    await AppDataSource.transaction(async (tx) => {
      const repo = tx.getRepository(ContractTemplate);
      await repo.update({ tenant_id, is_default: true, id: Not(t.id) }, { is_default: false });
      await repo.update({ id: t.id, tenant_id }, { is_default: true });
    });
    return res.json({ ...t, is_default: true });
  }

  // Modelo já usado em contrato é arquivado (o PDF desses contratos continua saindo); senão é excluído.
  async delete(req: Request, res: Response) {
    const { tenant_id } = req.user;
    const repo = AppDataSource.getRepository(ContractTemplate);
    const t = await repo.findOne({ where: { id: req.params.id, tenant_id } });
    if (!t) return res.status(404).json({ error: "Modelo não encontrado" });
    if (t.is_default) return res.status(400).json({ error: "O modelo padrão não pode ser excluído. Defina outro como padrão antes." });
    const used = await AppDataSource.getRepository(GrainContract).count({ where: { tenant_id, template_id: t.id } });
    if (used > 0) {
      await repo.update({ id: t.id, tenant_id }, { active: false });
      return res.json({ archived: true });
    }
    await repo.delete({ id: t.id, tenant_id });
    return res.json({ archived: false });
  }

  // Prévia do rascunho (sem salvar), com um contrato de exemplo ou um contrato real da corretora.
  async preview(req: Request, res: Response) {
    const { tenant_id } = req.user;
    const body = req.body ?? {};
    const tenant = await AppDataSource.getRepository(Tenant).findOne({ where: { id: tenant_id } });
    if (!tenant) return res.status(404).json({ error: "Corretora não encontrada" });

    let base = await ensureDefaultTemplate(tenant_id);
    if (typeof body.template_id === "string") {
      const t = await AppDataSource.getRepository(ContractTemplate).findOne({ where: { id: body.template_id, tenant_id } });
      if (t) base = t;
    }
    const { content, error } = normalizeContent(body, contentOf(base));
    if (error || !content) return res.status(400).json({ error });
    const v = normalizeVisual(body, visualOf(base));
    if (v.error || !v.visual) return res.status(400).json({ error: v.error });

    let contract: GrainContract | null = SAMPLE_CONTRACT;
    if (typeof body.contract_number === "string" && body.contract_number.trim()) {
      contract = await AppDataSource.getRepository(GrainContract).findOne({ where: { tenant_id, number_contract: body.contract_number.trim() } });
      if (!contract) return res.status(404).json({ error: "Contrato não encontrado" });
    }
    const fixations = contract === SAMPLE_CONTRACT ? [] : await getPdfFixations(tenant_id, contract);
    const role = body.role === "Comprador" ? "Comprador" : "Vendedor";
    const pdf = await generateContractPdf(contract, tenant, role, { ...content, ...v.visual }, fixations);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'inline; filename="previa-contrato.pdf"');
    return res.send(pdf);
  }
}
