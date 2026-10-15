import { GrainContract } from "../app/entities/GrainContract";
import { Tenant } from "../app/entities/Tenant";
import { ContractFixation } from "../app/entities/ContractFixation";
import { AppDataSource } from "../database/data-source";
import { formatCurrency, formatQuantity, insertMaskInCnpj } from "../utils/format";
import { FIELD_LABELS, ResolvedTemplate, TEXTS, TemplateLanguage, fillVariables } from "./contractTemplates";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfmake = require("pdfmake");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const robotoFonts = require("pdfmake/build/fonts/Roboto");

// Fontes embutidas em memória (sem ler do disco): funciona em serverless.
const FONT_FILES = ["Roboto-Regular.ttf", "Roboto-Medium.ttf", "Roboto-Italic.ttf", "Roboto-MediumItalic.ttf"];
for (const file of FONT_FILES) {
  pdfmake.virtualfs.writeFileSync(file, Buffer.from(robotoFonts.vfs[file].data, "base64"));
}
pdfmake.setUrlAccessPolicy(() => false);
pdfmake.setLocalAccessPolicy(() => false);
pdfmake.setFonts({
  Roboto: {
    normal: "Roboto-Regular.ttf",
    bold: "Roboto-Medium.ttf",
    italics: "Roboto-Italic.ttf",
    bolditalics: "Roboto-MediumItalic.ttf",
  },
});

export type ContractPdfRole = "Vendedor" | "Comprador";

// Textos fixos do PDF por idioma (os rótulos dos campos ficam em FIELD_LABELS).
const L = {
  "pt-BR": {
    to: "a", toFix: "a fixar", market: "A fixar: preço de mercado na data de cada fixação", frame: "A fixar (Frame)",
    premium: "Prêmio", exchange: "Câmbio", deadline: "Prazo para fixação", fixations: "Fixações realizadas",
    noFixations: "Nenhuma fixação lançada até o momento.", date: "Data", quantity: "Quantidade", price: "Preço",
    fixed: "Fixado", balance: "Saldo a fixar", average: "Preço médio",
  },
  en: {
    to: "to", toFix: "to be fixed", market: "To be fixed: market price on each fixation date", frame: "To be fixed (Frame)",
    premium: "Premium", exchange: "Exchange rate", deadline: "Fixation deadline", fixations: "Price fixations",
    noFixations: "No price fixations so far.", date: "Date", quantity: "Quantity", price: "Price",
    fixed: "Fixed", balance: "Balance to fix", average: "Average price",
  },
};

const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const join = (v: unknown) => (Array.isArray(v) ? v.join(", ") : v ? String(v) : "—");
const text = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));

// Aceita AAAA-MM-DD ou DD/MM/AAAA; outro formato sai como veio.
function fmtDate(v: unknown, lang: TemplateLanguage): string {
  if (v === null || v === undefined || v === "") return "—";
  const s = String(v);
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  const [d, m, y] = iso ? [iso[3], iso[2], iso[1]] : br ? [br[1], br[2], br[3]] : [];
  if (!d || !MONTHS_EN[Number(m) - 1]) return s;
  return lang === "en" ? `${MONTHS_EN[Number(m) - 1]} ${Number(d)}, ${y}` : `${d}/${m}/${y}`;
}

// Formatação dos números conforme o idioma do modelo.
function formatter(lang: TemplateLanguage) {
  const num = lang === "en" ? "en-US" : "pt-BR";
  return {
    money: (v: unknown, currency: string) => formatCurrency(v as number, currency, lang === "en" ? "en-US" : undefined),
    qty: (v: unknown) => formatQuantity(v as number, num),
    n: (v: number) => v.toLocaleString(num),
    date: (v: unknown) => fmtDate(v, lang),
  };
}

// Negrito com **texto**; o resto vai como texto puro.
const rich = (s: string) => s.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? { text: part, bold: true } : part)).filter((p) => p !== "");

function priceRows(contract: GrainContract, unit: string, lang: TemplateLanguage, label: string): [string, string][] {
  const t = L[lang];
  const f = formatter(lang);
  const currency = contract.type_currency;
  if (contract.price_type !== "to_fix") return [[label, `${f.money(contract.price, currency)} / ${unit}`]];
  const rows: [string, string][] = [];
  if (contract.fixation_mode === "market") {
    rows.push([label, t.market]);
  } else {
    const part = (v: unknown, fmt: (n: number) => string) => (v === null || v === undefined ? t.toFix : fmt(Number(v)));
    const cents = (n: number) => `${n > 0 ? "+" : ""}${f.n(n)} c/bu`;
    const parts = [
      `${t.premium}: ${part(contract.frame_premium, cents)}`,
      `Chicago (CBOT${contract.cbot_reference ? " " + contract.cbot_reference : ""}): ${part(contract.frame_chicago, (n) => `${f.n(n)} c/bu`)}`,
      ...(currency === "USD" ? [] : [`${t.exchange}: ${part(contract.frame_exchange, (n) => `R$ ${f.n(n)}`)}`]),
    ];
    rows.push([label, `${t.frame}: ${parts.join(" · ")}`]);
  }
  if (contract.fixation_deadline) rows.push([t.deadline, f.date(contract.fixation_deadline)]);
  return rows;
}

function fixationsSection(contract: GrainContract, fixations: ContractFixation[], unit: string, lang: TemplateLanguage): any[] {
  if (contract.price_type !== "to_fix") return [];
  const t = L[lang];
  const f = formatter(lang);
  const currency = contract.type_currency;
  const frame = contract.fixation_mode !== "market";
  const fixed = fixations.reduce((s, x) => s + Number(x.quantity), 0);
  const value = fixations.reduce((s, x) => s + Number(x.quantity) * Number(x.price), 0);
  const balance = Math.max(0, Number(contract.quantity) - fixed);
  const header = [t.date, `${t.quantity} (${unit})`, ...(frame ? ["Chicago (c/bu)", `${t.premium} (c/bu)`, ...(currency === "USD" ? [] : [`${t.exchange} (R$/US$)`])] : []), `${t.price} / ${unit}`].map((h) => ({ text: h, bold: true, fillColor: "#fef3c7" }));
  const body = fixations.map((x) => [
    f.date(x.fixation_date), f.qty(x.quantity),
    ...(frame ? [String(x.chicago ?? "—"), String(x.premium ?? "—"), ...(currency === "USD" ? [] : [String(x.exchange_rate ?? "—")])] : []),
    f.money(x.price, currency),
  ]);
  return [
    { text: t.fixations, bold: true, margin: [0, 16, 0, 6] },
    fixations.length === 0
      ? { text: t.noFixations, color: "#555555" }
      : { table: { headerRows: 1, widths: header.map(() => "*"), body: [header, ...body] }, layout: { hLineColor: () => "#e5e7eb", vLineColor: () => "#e5e7eb" } },
    { text: `${t.fixed}: ${f.qty(fixed)} ${unit} · ${t.balance}: ${f.qty(balance)} ${unit}${fixed > 0 ? ` · ${t.average}: ${f.money(value / fixed, currency)}` : ""}`, margin: [0, 6, 0, 0], bold: true },
  ];
}

// Linhas de um campo do modelo; um campo pode virar zero linhas (comissão vazia) ou duas (preço a fixar com prazo).
function fieldRows(key: string, label: string, contract: GrainContract, role: ContractPdfRole, lang: TemplateLanguage): [string, string][] {
  const f = formatter(lang);
  const unit = text(contract.type_quantity);
  const isSeller = role === "Vendedor";
  switch (key) {
    case "number_contract": return [[label, text(contract.number_contract)]];
    case "seller": return [[label, join(contract.seller)]];
    case "buyer": return [[label, join(contract.buyer)]];
    case "product": return [[label, text(contract.name_product)]];
    case "crop": return [[label, text(contract.crop)]];
    case "quality": return [[label, text(contract.quality)]];
    case "quantity": return [[label, `${f.qty(contract.quantity)} ${unit}`]];
    case "price": return priceRows(contract, unit, lang, label);
    case "icms": return [[label, text(contract.icms ? `${contract.type_icms || ""} ${contract.icms}`.trim() : contract.type_icms)]];
    case "payment": return [[label, text(contract.payment)]];
    case "pickup_location": return [[label, text(contract.pickup_location)]];
    case "pickup_period": return [[label, `${f.date(contract.initial_pickup_date)} ${L[lang].to} ${f.date(contract.final_pickup_date)}`]];
    case "destination": return [[label, text(contract.destination)]];
    case "external_number": return [[label, text(isSeller ? contract.number_external_contract_seller : contract.number_external_contract_buyer)]];
    case "inspection": return [[label, text(contract.inspection)]];
    case "observation": return [[label, text(contract.observation)]];
    case "commission": {
      // Cada parte só vê a própria comissão.
      const commission = isSeller ? contract.commission_seller : contract.commission_buyer;
      const type = isSeller ? contract.type_commission_seller : contract.type_commission_buyer;
      const total = Number(isSeller ? contract.commission_seller_contract_value : contract.commission_buyer_contract_value);
      if (commission === null || commission === undefined || String(commission).trim() === "") return [];
      return [[label, `${commission} ${type || ""}`.trim() + (total > 0 ? ` (${f.money(total, contract.type_currency)})` : "")]];
    }
    default: return [];
  }
}

// Valores das variáveis {{...}} das cláusulas, já formatados no idioma do modelo.
export function variableValues(contract: GrainContract, tenant: Tenant, lang: TemplateLanguage): Record<string, string> {
  const f = formatter(lang);
  const unit = text(contract.type_quantity);
  return {
    numero_contrato: text(contract.number_contract),
    vendedor: join(contract.seller),
    comprador: join(contract.buyer),
    produto: text(contract.name_product),
    safra: text(contract.crop),
    qualidade: text(contract.quality),
    quantidade: f.qty(contract.quantity) || "—",
    unidade: unit,
    preco: contract.price_type === "to_fix" ? L[lang].toFix : `${f.money(contract.price, contract.type_currency)} / ${unit}`,
    moeda: text(contract.type_currency),
    pagamento: text(contract.payment),
    local_retirada: text(contract.pickup_location),
    periodo_retirada: `${f.date(contract.initial_pickup_date)} ${L[lang].to} ${f.date(contract.final_pickup_date)}`,
    destino: text(contract.destination),
    data_emissao: f.date(contract.contract_emission_date),
    corretora: text(tenant.name),
    cnpj_corretora: tenant.cnpj ? insertMaskInCnpj(tenant.cnpj) : "—",
  };
}

// Endereço da corretora numa linha: "Rua X, 123 - Sala 4 - Centro - Cidade/UF - CEP 00000-000".
export function tenantAddressLine(tenant: Tenant): string {
  const street = [tenant.address, tenant.number].map((v) => (v ?? "").trim()).filter(Boolean).join(", ");
  const city = [tenant.city, tenant.state].map((v) => (v ?? "").trim()).filter(Boolean).join("/");
  const zip = (tenant.zip_code ?? "").trim();
  return [street, tenant.complement?.trim(), tenant.district?.trim(), city, zip && `CEP ${zip}`].filter(Boolean).join(" - ");
}

export const roleLabel = (role: ContractPdfRole, lang: TemplateLanguage = "pt-BR") => TEXTS[lang].roles[role];

export function contractPdfFilename(contract: GrainContract, role: ContractPdfRole, lang: TemplateLanguage = "pt-BR"): string {
  return `contrato_${String(contract.number_contract).replace(/[^\w.-]+/g, "_")}_${roleLabel(role, lang).toLowerCase()}.pdf`;
}

// Fixações que entram no PDF, na ordem da numeração (F01, F02...); só contratos a fixar têm.
export async function getPdfFixations(tenantId: string, contract: GrainContract): Promise<ContractFixation[]> {
  if (contract.price_type !== "to_fix") return [];
  return AppDataSource.getRepository(ContractFixation).find({
    where: { tenant_id: tenantId, contract_id: contract.id },
    order: { sequence: "ASC", fixation_date: "ASC", created_at: "ASC" },
  });
}

export async function generateContractPdf(
  contract: GrainContract,
  tenant: Tenant,
  role: ContractPdfRole,
  template: ResolvedTemplate,
  fixations: ContractFixation[] = []
): Promise<Buffer> {
  const lang = template.language;
  const unit = text(contract.type_quantity);
  const vars = variableValues(contract, tenant, lang);
  const fill = (s: string) => fillVariables(s, vars);

  const rows = template.fields
    .filter((fl) => fl.visible && FIELD_LABELS[fl.key])
    .flatMap((fl) => fieldRows(fl.key, fl.label || FIELD_LABELS[fl.key][lang], contract, role, lang));

  const clauses = template.clauses.flatMap((c, i) => [
    { text: `${i + 1}. ${fill(c.title)}`.trim(), bold: true, margin: [0, i === 0 ? 18 : 10, 0, 4] },
    ...(c.body ? [{ text: rich(fill(c.body)), alignment: "justify" }] : []),
  ]);

  const align = template.logo_data ? template.logo_position : "left";
  // Linhas sob o nome da corretora: CNPJ e, se o modelo pedir, o endereço.
  const address = template.show_address ? tenantAddressLine(tenant) : "";
  const headerLines = [tenant.cnpj ? `${TEXTS[lang].cnpj} ${insertMaskInCnpj(tenant.cnpj)}` : "", ...(address ? [address] : [])];
  const docDefinition = {
    pageSize: "A4",
    pageMargins: [40, 50, 40, 50],
    defaultStyle: { font: "Roboto", fontSize: 10 },
    background: template.watermark_enabled && template.watermark_data
      ? (_page: number, pageSize: { width: number; height: number }) => {
          const w = Math.min(pageSize.width * 0.7, 400);
          return {
            image: template.watermark_data,
            width: w,
            opacity: template.watermark_opacity,
            absolutePosition: { x: (pageSize.width - w) / 2, y: pageSize.height * 0.3 },
          };
        }
      : undefined,
    content: [
      ...(template.logo_data
        ? [{ image: template.logo_data, width: template.logo_width, alignment: template.logo_position, margin: [0, 0, 0, 12] }]
        : []),
      { text: tenant.name, style: "title", alignment: align },
      ...headerLines.map((line, i) => ({ text: line, color: "#555555", alignment: align, ...(i === headerLines.length - 1 ? { margin: [0, 0, 0, 12] } : {}) })),
      { text: `${template.title} - ${roleLabel(role, lang).toUpperCase()}`, style: "subtitle" },
      ...(rows.length > 0
        ? [{
            table: { widths: [140, "*"], body: rows.map(([k, v]) => [{ text: k, bold: true, fillColor: "#fef3c7" }, { text: v }]) },
            layout: { hLineColor: () => "#e5e7eb", vLineColor: () => "#e5e7eb" },
          }]
        : []),
      ...(template.show_fixations ? fixationsSection(contract, fixations, unit, lang) : []),
      ...clauses,
      ...(template.closing_text ? [{ text: rich(fill(template.closing_text)), margin: [0, 24, 0, 0] }] : []),
      ...(template.signatures.length > 0
        ? [{
            margin: [0, 40, 0, 0],
            columns: template.signatures.map((s) => ({ text: `______________________________\n${s}`, alignment: "center", color: "#555555" })),
          }]
        : []),
    ],
    styles: {
      title: { fontSize: 16, bold: true },
      subtitle: { fontSize: 12, bold: true, margin: [0, 0, 0, 10] },
    },
  };

  const buffer = await pdfmake.createPdf(docDefinition).getBuffer();
  return Buffer.from(buffer);
}
