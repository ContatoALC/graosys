import { In } from "typeorm";
import { AppDataSource } from "../database/data-source";
import { GrainContract } from "../app/entities/GrainContract";
import { Client } from "../app/entities/Client";
import { Billing } from "../app/entities/Billing";
import { formatCurrency, formatQuantity } from "../utils/format";

// Dados para a pessoa da Cobrança emitir a NFS-e no site da prefeitura (copiar e colar), até haver emissão integrada.
// Uma nota por parte que paga comissão (vendedor e/ou comprador); o tomador vem do cadastro de clientes.

const SERVICE_CODE = "10.05";
const SERVICE_DESCRIPTION = "Agenciamento, corretagem ou intermediação de bens móveis ou imóveis, não abrangidos em outros itens ou subitens";

type Party = "seller" | "buyer";

const commissionLabel = (type: string | null, value: string | null) => {
  if (!value) return "";
  const v = String(value).replace(".", ",");
  if (type === "%") return `${v}%`;
  // "R$/sc", "R$/ton" → "R$ 0,50/sc"
  const unit = /^R\$\/(.+)$/.exec(type || "");
  return unit ? `R$ ${v}/${unit[1]}` : `${type || ""} ${v}`.trim();
};

const names = (v: unknown) => (Array.isArray(v) ? v.filter(Boolean).join(", ") : String(v || ""));

function tomadorOf(client: Client | null, fallbackName: string, emails: string[]) {
  const contactEmails = ((client?.contacts as { email?: string }[]) || []).map((c) => c?.email).filter(Boolean) as string[];
  const email = contactEmails[0] || emails[0] || "";
  const t = {
    client_id: client?.id ?? null,
    name: client?.name || fallbackName,
    kind: client?.kind ?? null,
    cnpj_cpf: client?.cnpj_cpf ?? "",
    ins_mun: client?.ins_mun ?? "",
    ins_est: client?.ins_est ?? "",
    address: client?.address ?? "",
    number: client?.number ?? "",
    complement: client?.complement ?? "",
    district: client?.district ?? "",
    city: client?.city ?? "",
    state: client?.state ?? "",
    zip_code: client?.zip_code ?? "",
    email,
    phone: client?.telephone || client?.cellphone || "",
  };
  const missing: string[] = [];
  if (!client) missing.push("cadastro do cliente (a parte foi digitada sem vínculo)");
  else {
    if (!t.cnpj_cpf) missing.push("CNPJ/CPF");
    if (!t.address || !t.city || !t.state) missing.push("endereço");
    if (!t.zip_code) missing.push("CEP");
  }
  return { ...t, missing };
}

export async function nfseData(tenantId: string, contractId: string) {
  const contract = await AppDataSource.getRepository(GrainContract).findOne({ where: { id: contractId, tenant_id: tenantId } });
  if (!contract) return null;

  const ids = [...(contract.seller_ids || []), ...(contract.buyer_ids || [])].filter(Boolean) as string[];
  const clients = ids.length ? await AppDataSource.getRepository(Client).find({ where: { tenant_id: tenantId, id: In(ids) } }) : [];
  const byId = new Map(clients.map((c) => [c.id, c]));
  const usd = contract.type_currency === "USD";
  const qty = `${formatQuantity(contract.quantity)} ${contract.type_quantity || ""}`.trim();

  const notes = (["seller", "buyer"] as Party[]).flatMap((party) => {
    const value = Number(party === "seller" ? contract.commission_seller_contract_value : contract.commission_buyer_contract_value) || 0;
    if (value <= 0) return [];
    const role = party === "seller" ? "Vendedor" : "Comprador";
    const partyNames = party === "seller" ? contract.seller : contract.buyer;
    const partyIds = (party === "seller" ? contract.seller_ids : contract.buyer_ids) || [];
    const firstId = partyIds.find(Boolean);
    const client = firstId ? byId.get(firstId) ?? null : null;
    const emails = (party === "seller" ? contract.list_email_seller : contract.list_email_buyer) || [];
    const rate = commissionLabel(
      party === "seller" ? contract.type_commission_seller : contract.type_commission_buyer,
      party === "seller" ? contract.commission_seller : contract.commission_buyer
    );
    const description =
      `Intermediação (corretagem) na compra e venda de ${qty} de ${contract.name_product || "grãos"}` +
      `${contract.crop ? `, safra ${contract.crop}` : ""}, conforme contrato nº ${contract.number_contract}` +
      ` entre ${names(contract.seller) || "—"} (vendedor) e ${names(contract.buyer) || "—"} (comprador).` +
      ` Comissão devida pelo ${role.toLowerCase()}${rate ? `: ${rate}` : ""}.`;
    return [{
      party,
      role,
      value,
      value_label: formatCurrency(value, contract.type_currency),
      currency: contract.type_currency,
      commission_rate: rate,
      several_parties: Array.isArray(partyNames) && partyNames.filter(Boolean).length > 1 ? names(partyNames) : null,
      tomador: tomadorOf(client, names(partyNames), emails),
      description,
    }];
  });

  const billings = await AppDataSource.getRepository(Billing).find({
    where: { tenant_id: tenantId, number_contract: contract.number_contract },
    order: { created_at: "ASC" },
    select: ["id", "total_service_value", "status", "receipt_date", "expected_receipt_date", "rps_number", "nfs_number"],
  });

  return {
    contract: {
      id: contract.id,
      number_contract: contract.number_contract,
      type_currency: contract.type_currency,
      day_exchange_rate: contract.day_exchange_rate || null,
    },
    service: { code: SERVICE_CODE, description: SERVICE_DESCRIPTION },
    usd_warning: usd
      ? "Contrato em dólar: a NFS-e é emitida em reais. Converta o valor pela taxa de câmbio combinada para o recebimento."
      : null,
    notes,
    billings: billings.map((b) => ({ ...b, total_service_value: Number(b.total_service_value) })),
  };
}
