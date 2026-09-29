import { EntityManager } from "typeorm";
import { AppDataSource } from "../database/data-source";
import { Broker } from "../app/entities/Broker";
import { ContractBroker } from "../app/entities/ContractBroker";

export interface ContractBrokerInput {
  broker_id: string;
  commission_percent?: number | string | null; // vazio = tabela de comissão do broker na data do contrato
}

const pct = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : Number(v));
const today = () => new Date().toISOString().slice(0, 10);

// SQL do % vigente de um broker numa data (a vigência mais recente com início até essa data).
export const RATE_AT = (brokerCol: string, dateExpr: string) => `(
  SELECT r.percent FROM broker_commission_rates r
   WHERE r.broker_id = ${brokerCol} AND r.valid_from <= ${dateExpr}
   ORDER BY r.valid_from DESC, r.created_at DESC LIMIT 1)`;

// % vigente de cada broker da corretora numa data (padrão: hoje).
export async function currentRates(tenantId: string, date = today()): Promise<Map<string, number>> {
  const rows = await AppDataSource.query(
    `SELECT b.id, ${RATE_AT("b.id", "$2")} AS percent FROM brokers b WHERE b.tenant_id = $1`, [tenantId, date]
  );
  return new Map(rows.filter((r: any) => r.percent !== null).map((r: any) => [r.id, Number(r.percent)]));
}

// Valida a lista de brokers do contrato; devolve mensagem de erro ou null.
export async function validateContractBrokers(tenantId: string, input: unknown, contractDate?: string | null): Promise<string | null> {
  if (input === undefined) return null;
  if (!Array.isArray(input)) return "Brokers inválidos";
  const list = input as ContractBrokerInput[];
  const ids = list.map((b) => b?.broker_id);
  if (ids.some((id) => !id)) return "Selecione o broker em todas as linhas";
  if (new Set(ids).size !== ids.length) return "O mesmo broker aparece mais de uma vez no contrato";

  const brokers = ids.length
    ? await AppDataSource.getRepository(Broker).createQueryBuilder("b")
        .where("b.tenant_id = :tenantId AND b.id IN (:...ids)", { tenantId, ids }).getMany()
    : [];
  if (brokers.length !== ids.length) return "Broker não encontrado";

  const rates = await currentRates(tenantId, contractDate || today());
  let total = 0;
  for (const item of list) {
    const p = pct(item.commission_percent);
    if (p !== null && (!Number.isFinite(p) || p < 0 || p > 100)) return "O % do broker deve estar entre 0 e 100";
    total += p ?? rates.get(item.broker_id) ?? 0;
  }
  if (total > 100 + 1e-6) return `A soma dos % dos brokers passa de 100% (${total.toLocaleString("pt-BR")}%)`;
  return null;
}

export async function saveContractBrokers(tx: EntityManager, tenantId: string, contractId: string, input: ContractBrokerInput[]) {
  const repo = tx.getRepository(ContractBroker);
  await repo.delete({ tenant_id: tenantId, contract_id: contractId });
  if (!input.length) return;
  await repo.save(input.map((b) => repo.create({
    tenant_id: tenantId, contract_id: contractId, broker_id: b.broker_id, commission_percent: pct(b.commission_percent),
  })));
}

// Brokers do contrato com o % próprio (se houver) e o % da tabela na data do contrato.
export async function loadContractBrokers(tenantId: string, contractId: string, contractDate?: string | null) {
  const rows = await AppDataSource.query(
    `SELECT cb.broker_id, b.name, cb.commission_percent, ${RATE_AT("cb.broker_id", "$3")} AS table_percent
       FROM contract_brokers cb JOIN brokers b ON b.id = cb.broker_id
      WHERE cb.tenant_id = $1 AND cb.contract_id = $2 ORDER BY cb.created_at, b.name`,
    [tenantId, contractId, contractDate || today()]
  );
  return rows.map((r: any) => ({
    broker_id: r.broker_id, name: r.name,
    commission_percent: r.commission_percent === null ? null : Number(r.commission_percent),
    table_percent: r.table_percent === null ? null : Number(r.table_percent),
  }));
}
