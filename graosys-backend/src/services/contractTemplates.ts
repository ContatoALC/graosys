import { EntityManager } from "typeorm";
import { v4 as uuid } from "uuid";
import { AppDataSource } from "../database/data-source";
import { ContractTemplate } from "../app/entities/ContractTemplate";
import { GrainContract } from "../app/entities/GrainContract";
import { TenantPdfSettings } from "../app/entities/TenantPdfSettings";

export type TemplateLanguage = "pt-BR" | "en";
export const LANGUAGES: TemplateLanguage[] = ["pt-BR", "en"];

export interface TemplateField { key: string; visible: boolean; label?: string | null }
export interface TemplateClause { id: string; title: string; body: string }

// Parte textual do modelo: é o que fica congelado no contrato a cada envio.
export interface TemplateContent {
  template_id?: string;
  name?: string;
  language: TemplateLanguage;
  title: string;
  fields: TemplateField[];
  show_fixations: boolean;
  show_address?: boolean; // ausente nos textos congelados antes da opção existir
  clauses: TemplateClause[];
  closing_text: string;
  signatures: string[];
}

export interface TemplateVisual {
  logo_data: string | null;
  logo_position: string;
  logo_width: number;
  watermark_data: string | null;
  watermark_opacity: number;
  watermark_enabled: boolean;
}

export type ResolvedTemplate = TemplateContent & TemplateVisual;

// Linhas da tabela do PDF, na ordem padrão (a mesma do PDF antes dos modelos).
export const FIELD_LABELS: Record<string, Record<TemplateLanguage, string>> = {
  number_contract: { "pt-BR": "Nº Contrato", en: "Contract No." },
  seller: { "pt-BR": "Vendedor", en: "Seller" },
  buyer: { "pt-BR": "Comprador", en: "Buyer" },
  product: { "pt-BR": "Produto", en: "Product" },
  crop: { "pt-BR": "Safra", en: "Crop" },
  quality: { "pt-BR": "Qualidade", en: "Quality" },
  quantity: { "pt-BR": "Quantidade", en: "Quantity" },
  price: { "pt-BR": "Preço", en: "Price" },
  icms: { "pt-BR": "ICMS", en: "ICMS" },
  payment: { "pt-BR": "Pagamento", en: "Payment" },
  pickup_location: { "pt-BR": "Retirada", en: "Pickup location" },
  pickup_period: { "pt-BR": "Período de retirada", en: "Pickup period" },
  destination: { "pt-BR": "Destino", en: "Destination" },
  external_number: { "pt-BR": "Nº contrato externo", en: "External contract No." },
  inspection: { "pt-BR": "Inspeção", en: "Inspection" },
  commission: { "pt-BR": "Comissão", en: "Commission" },
  observation: { "pt-BR": "Observação", en: "Remarks" },
};
export const FIELD_KEYS = Object.keys(FIELD_LABELS);

// Variáveis aceitas nas cláusulas e no texto final: {{nome}}. Os nomes são em português nos dois idiomas.
export const VARIABLES: Record<string, string> = {
  numero_contrato: "Número do contrato",
  vendedor: "Vendedor(es)",
  comprador: "Comprador(es)",
  produto: "Produto",
  safra: "Safra",
  qualidade: "Qualidade",
  quantidade: "Quantidade (número)",
  unidade: "Unidade (sc, kg, ton)",
  preco: "Preço",
  moeda: "Moeda (BRL, USD)",
  pagamento: "Pagamento",
  local_retirada: "Local de retirada",
  periodo_retirada: "Período de retirada",
  destino: "Destino",
  data_emissao: "Data de emissão",
  corretora: "Nome da corretora",
  cnpj_corretora: "CNPJ da corretora",
};

export const TEXTS = {
  "pt-BR": {
    title: "CONFIRMAÇÃO DE CONTRATO",
    closing: "Solicitamos carimbar, assinar e devolver esta confirmação por e-mail.",
    signatures: ["Assinatura / Carimbo", "Data"],
    roles: { Vendedor: "Vendedor", Comprador: "Comprador" },
    cnpj: "CNPJ",
  },
  en: {
    title: "CONTRACT CONFIRMATION",
    closing: "Please sign, stamp and return this confirmation by e-mail.",
    signatures: ["Signature / Stamp", "Date"],
    roles: { Vendedor: "Seller", Comprador: "Buyer" },
    cnpj: "Tax ID (CNPJ)",
  },
} as const;

export const MAX_CLAUSES = 50;
export const MAX_CLAUSE_BODY = 5000;
const MAX_SIGNATURES = 4;
const VAR_RE = /\{\{\s*([^{}]*?)\s*\}\}/g;

export function defaultContent(language: TemplateLanguage): TemplateContent {
  const t = TEXTS[language];
  return {
    language,
    title: t.title,
    fields: FIELD_KEYS.map((key) => ({ key, visible: true, label: null })),
    show_fixations: true,
    show_address: false,
    clauses: [],
    closing_text: t.closing,
    signatures: [...t.signatures],
  };
}

export const DEFAULT_VISUAL: TemplateVisual = {
  logo_data: null, logo_position: "left", logo_width: 120, watermark_data: null, watermark_opacity: 0.1, watermark_enabled: false,
};

export function contentOf(t: ContractTemplate): TemplateContent {
  return {
    template_id: t.id, name: t.name, language: t.language as TemplateLanguage, title: t.title, fields: t.fields,
    show_fixations: t.show_fixations, show_address: t.show_address, clauses: t.clauses, closing_text: t.closing_text, signatures: t.signatures,
  };
}

export function visualOf(t: TemplateVisual | null | undefined): TemplateVisual {
  if (!t) return { ...DEFAULT_VISUAL };
  return {
    logo_data: t.logo_data, logo_position: t.logo_position, logo_width: t.logo_width,
    watermark_data: t.watermark_data, watermark_opacity: t.watermark_opacity, watermark_enabled: t.watermark_enabled,
  };
}

export function unknownVariables(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(VAR_RE)) if (!(m[1] in VARIABLES) && !out.includes(m[1])) out.push(m[1]);
  return out;
}

export function fillVariables(text: string, values: Record<string, string>): string {
  return text.replace(VAR_RE, (whole, name) => (name in values ? values[name] : whole));
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// Valida e normaliza a parte textual vinda da tela. Campos ausentes mantêm o valor de `base`.
export function normalizeContent(body: any, base: TemplateContent): { content?: TemplateContent; error?: string } {
  const c: TemplateContent = { ...base };

  if (body.language !== undefined) {
    if (!LANGUAGES.includes(body.language)) return { error: "Idioma inválido" };
    c.language = body.language;
  }
  if (body.title !== undefined) c.title = str(body.title, 120) || TEXTS[c.language].title;
  if (body.show_fixations !== undefined) c.show_fixations = Boolean(body.show_fixations);
  if (body.show_address !== undefined) c.show_address = Boolean(body.show_address);
  if (body.closing_text !== undefined) c.closing_text = str(body.closing_text, 2000);

  if (body.fields !== undefined) {
    if (!Array.isArray(body.fields)) return { error: "Campos inválidos" };
    const fields: TemplateField[] = [];
    for (const f of body.fields) {
      if (!f || !FIELD_KEYS.includes(f.key)) return { error: `Campo desconhecido: ${String(f?.key).slice(0, 40)}` };
      if (fields.some((x) => x.key === f.key)) return { error: `Campo repetido: ${f.key}` };
      fields.push({ key: f.key, visible: Boolean(f.visible), label: str(f.label, 60) || null });
    }
    // Campo que não veio entra no fim, oculto.
    for (const key of FIELD_KEYS) if (!fields.some((f) => f.key === key)) fields.push({ key, visible: false, label: null });
    c.fields = fields;
  }

  if (body.clauses !== undefined) {
    if (!Array.isArray(body.clauses)) return { error: "Cláusulas inválidas" };
    if (body.clauses.length > MAX_CLAUSES) return { error: `Máximo de ${MAX_CLAUSES} cláusulas` };
    const clauses: TemplateClause[] = [];
    for (const [i, cl] of body.clauses.entries()) {
      const title = str(cl?.title, 200);
      const text = typeof cl?.body === "string" ? cl.body.trim() : "";
      if (!title && !text) continue;
      if (text.length > MAX_CLAUSE_BODY) return { error: `A cláusula ${i + 1} passa de ${MAX_CLAUSE_BODY} caracteres` };
      clauses.push({ id: typeof cl?.id === "string" && cl.id ? cl.id.slice(0, 40) : uuid(), title, body: text });
    }
    c.clauses = clauses;
  }

  if (body.signatures !== undefined) {
    if (!Array.isArray(body.signatures)) return { error: "Assinaturas inválidas" };
    c.signatures = body.signatures.map((s: unknown) => str(s, 60)).filter(Boolean).slice(0, MAX_SIGNATURES);
  }

  const unknown = unknownVariables([c.closing_text, ...c.clauses.flatMap((cl) => [cl.title, cl.body])].join("\n"));
  if (unknown.length > 0) return { error: `Variável desconhecida: ${unknown.map((v) => `{{${v}}}`).join(", ")}` };
  return { content: c };
}

// Modelo padrão da corretora; se ainda não houver nenhum (corretora nova), cria o "Padrão" com o visual antigo.
export async function ensureDefaultTemplate(tenantId: string, manager: EntityManager = AppDataSource.manager): Promise<ContractTemplate> {
  const repo = manager.getRepository(ContractTemplate);
  const found = await repo.findOne({ where: { tenant_id: tenantId, is_default: true } });
  if (found) return found;
  const legacy = await manager.getRepository(TenantPdfSettings).findOne({ where: { tenant_id: tenantId } });
  const created = repo.create({ tenant_id: tenantId, name: "Padrão", is_default: true, active: true, ...defaultContent("pt-BR"), ...visualOf(legacy) });
  try {
    return await repo.save(created);
  } catch (e) {
    // Outra requisição criou ao mesmo tempo (índice único do padrão).
    const again = await repo.findOne({ where: { tenant_id: tenantId, is_default: true } });
    if (again) return again;
    throw e;
  }
}

// Modelo vigente do contrato: o escolhido nele ou, sem escolha, o padrão da corretora.
export async function currentTemplate(tenantId: string, contract: Pick<GrainContract, "template_id">): Promise<ContractTemplate> {
  if (contract.template_id) {
    const t = await AppDataSource.getRepository(ContractTemplate).findOne({ where: { id: contract.template_id, tenant_id: tenantId } });
    if (t) return t;
  }
  return ensureDefaultTemplate(tenantId);
}

// O que vai no PDF: o texto congelado no último envio (se ainda é do mesmo modelo) ou o modelo atual.
// Logo e marca d'água vêm sempre do modelo atual.
export async function resolveContractTemplate(tenantId: string, contract: GrainContract): Promise<{ template: ContractTemplate; resolved: ResolvedTemplate }> {
  const template = await currentTemplate(tenantId, contract);
  const snapshot = contract.template_snapshot;
  const content = snapshot && snapshot.template_id === template.id ? snapshot : contentOf(template);
  return { template, resolved: { ...content, ...visualOf(template) } };
}
