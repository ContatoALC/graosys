import { AppDataSource } from "../database/data-source";
import { RATE_AT } from "./contractBrokers";

// Comissão do broker = comissão do contrato × % do broker no contrato (ou o % da tabela do broker na data do contrato).
// Liberada na proporção do que a corretora já recebeu (valor do serviço dos recebimentos "Recebido" do contrato).
// Contratos cancelados não entram.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// Data do contrato: emissão (texto ISO) ou, na falta, a data de criação.
const D = `COALESCE(NULLIF(c.contract_emission_date, ''), to_char(c.created_at, 'YYYY-MM-DD'))`;

export interface BrokerFilter {
  brokerId?: string;
  from?: string;
  to?: string;
}

export interface BrokerContractRow {
  broker_id: string;
  broker_name: string;
  contract_id: string;
  number_contract: string;
  contract_date: string;
  name_product: string;
  crop: string;
  seller: string[];
  buyer: string[];
  quantity_kg: number;
  total_contract_value: number;
  type_currency: string;
  status: string;
  commission_contract: number;
  received: number;
  percent: number;
  broker_commission: number;
  released: number;
  pending: number;
}

export async function brokerContractRows(tenantId: string, f: BrokerFilter): Promise<BrokerContractRow[]> {
  const params: unknown[] = [tenantId];
  let where = `cb.tenant_id = $1 AND COALESCE(c.status->>'status_current', '') <> 'Cancelado'`;
  if (f.brokerId) { params.push(f.brokerId); where += ` AND cb.broker_id = $${params.length}`; }
  if (f.from && DATE_RE.test(f.from)) { params.push(f.from); where += ` AND ${D} >= $${params.length}`; }
  if (f.to && DATE_RE.test(f.to)) { params.push(f.to); where += ` AND ${D} <= $${params.length}`; }

  const rows = await AppDataSource.query(
    `WITH recv AS (
       SELECT number_contract, sum(total_service_value) AS received
         FROM billings WHERE tenant_id = $1 AND status = 'received' GROUP BY number_contract
     )
     SELECT b.id AS broker_id, b.name AS broker_name, c.id AS contract_id, c.number_contract, ${D} AS contract_date,
            c.name_product, c.crop, c.seller, c.buyer, COALESCE(c.quantity_kg, 0) AS quantity_kg,
            COALESCE(c.total_contract_value, 0) AS total_contract_value, c.type_currency,
            COALESCE(c.status->>'status_current', 'Sem status') AS status,
            COALESCE(c.commission_contract, 0) AS commission_contract, COALESCE(r.received, 0) AS received,
            COALESCE(cb.commission_percent, ${RATE_AT("b.id", D)}, 0) AS percent
       FROM contract_brokers cb
       JOIN brokers b ON b.id = cb.broker_id AND b.tenant_id = cb.tenant_id
       JOIN grain_contracts c ON c.id = cb.contract_id AND c.tenant_id = cb.tenant_id
       LEFT JOIN recv r ON r.number_contract = c.number_contract
      WHERE ${where}
      ORDER BY ${D} DESC, c.number_contract DESC`,
    params
  );

  return rows.map((r: any) => {
    const commission = Number(r.commission_contract);
    const percent = Number(r.percent);
    const brokerCommission = round2((commission * percent) / 100);
    const fraction = commission > 0 ? Math.min(1, Number(r.received) / commission) : 0;
    const released = round2(brokerCommission * fraction);
    return {
      ...r,
      quantity_kg: Number(r.quantity_kg),
      total_contract_value: Number(r.total_contract_value),
      commission_contract: commission,
      received: Number(r.received),
      percent,
      broker_commission: brokerCommission,
      released,
      pending: round2(brokerCommission - released),
    };
  });
}

const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

export function summarize(rows: BrokerContractRow[]) {
  const sum = (k: keyof BrokerContractRow) => round2(rows.reduce((s, r) => s + Number(r[k] || 0), 0));
  const contracts = new Set(rows.map((r) => r.contract_id)).size;
  return {
    contracts,
    volume_kg: sum("quantity_kg"),
    contract_value: sum("total_contract_value"),
    commission_contract: sum("commission_contract"),
    broker_commission: sum("broker_commission"),
    released: sum("released"),
    pending: sum("pending"),
    average_ticket: contracts ? round2(sum("broker_commission") / contracts) : 0,
  };
}

// Agrupa as linhas por uma chave (mês, produto, broker), somando os indicadores.
export function groupBy(rows: BrokerContractRow[], key: (r: BrokerContractRow) => string) {
  const map = new Map<string, BrokerContractRow[]>();
  for (const r of rows) {
    const k = key(r);
    map.set(k, [...(map.get(k) || []), r]);
  }
  return [...map.entries()].map(([k, rs]) => ({ key: k, ...summarize(rs) }));
}
