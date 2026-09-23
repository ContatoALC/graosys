import { GrainContract } from "../app/entities/GrainContract";
import { Tenant } from "../app/entities/Tenant";
import { formatCurrency, formatQuantity, insertMaskInCnpj } from "../utils/format";

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

const join = (v: unknown) => (Array.isArray(v) ? v.join(", ") : v ? String(v) : "—");
const text = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));

export async function generateContractPdf(contract: GrainContract, tenant: Tenant, role: ContractPdfRole): Promise<Buffer> {
  const isSeller = role === "Vendedor";
  const currency = contract.type_currency;
  const unit = text(contract.type_quantity);

  const rows: [string, string][] = [
    ["Nº Contrato", text(contract.number_contract)],
    ["Vendedor", join(contract.seller)],
    ["Comprador", join(contract.buyer)],
    ["Produto", text(contract.name_product)],
    ["Safra", text(contract.crop)],
    ["Qualidade", text(contract.quality)],
    ["Quantidade", `${formatQuantity(contract.quantity)} ${unit}`],
    ["Preço", `${formatCurrency(contract.price, currency)} / ${unit}`],
    ["ICMS", text(contract.icms ? `${contract.type_icms || ""} ${contract.icms}`.trim() : contract.type_icms)],
    ["Pagamento", text(contract.payment)],
    ["Retirada", text(contract.pickup_location)],
    ["Período de retirada", `${text(contract.initial_pickup_date)} a ${text(contract.final_pickup_date)}`],
    ["Destino", text(contract.destination)],
    ["Nº contrato externo", text(isSeller ? contract.number_external_contract_seller : contract.number_external_contract_buyer)],
    ["Inspeção", text(contract.inspection)],
    ["Observação", text(contract.observation)],
  ];

  const docDefinition = {
    pageSize: "A4",
    pageMargins: [40, 50, 40, 50],
    defaultStyle: { font: "Roboto", fontSize: 10 },
    content: [
      { text: tenant.name, style: "title" },
      { text: tenant.cnpj ? `CNPJ ${insertMaskInCnpj(tenant.cnpj)}` : "", color: "#555555", margin: [0, 0, 0, 12] },
      { text: `CONFIRMAÇÃO DE CONTRATO - ${role.toUpperCase()}`, style: "subtitle" },
      {
        table: {
          widths: [140, "*"],
          body: rows.map(([k, v]) => [{ text: k, bold: true, fillColor: "#fef3c7" }, { text: v }]),
        },
        layout: { hLineColor: () => "#e5e7eb", vLineColor: () => "#e5e7eb" },
      },
      { text: "Solicitamos carimbar, assinar e devolver esta confirmação por e-mail.", margin: [0, 24, 0, 40] },
      {
        columns: [
          { text: "______________________________\nAssinatura / Carimbo", alignment: "center", color: "#555555" },
          { text: "______________________________\nData", alignment: "center", color: "#555555" },
        ],
      },
    ],
    styles: {
      title: { fontSize: 16, bold: true },
      subtitle: { fontSize: 12, bold: true, margin: [0, 0, 0, 10] },
    },
  };

  const buffer = await pdfmake.createPdf(docDefinition).getBuffer();
  return Buffer.from(buffer);
}
