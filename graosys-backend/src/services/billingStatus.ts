import { AppDataSource } from "../database/data-source";
import { GrainContract } from "../app/entities/GrainContract";

// Status de cobrança do contrato, calculado a partir dos Recebimentos lançados com o mesmo nº de contrato.
export type BillingStatus = "A Faturar" | "A Receber" | "Parcial" | "Recebido" | "Em Atraso";

export interface BillingInfo {
  billing_status: BillingStatus | null; // null em contrato cancelado
  billing_received: number; // soma do valor do serviço (bruto) dos recebimentos já recebidos
}

// Tolerância de arredondamento ao comparar o recebido com a comissão.
const EPSILON = 0.01;

export function billingStatusOf(
  contract: Pick<GrainContract, "commission_contract" | "status">,
  agg: { active: number; received: number; overdue: boolean } | undefined
): BillingStatus | null {
  if (contract.status?.status_current === "Cancelado") return null;
  if (!agg || agg.active === 0) return "A Faturar";
  const commission = Number(contract.commission_contract || 0);
  if (agg.received > 0 && agg.received + EPSILON >= commission) return "Recebido";
  if (agg.overdue) return "Em Atraso";
  if (agg.received > 0) return "Parcial";
  return "A Receber";
}

export async function withBillingStatus<T extends GrainContract>(tenantId: string, contracts: T[]): Promise<(T & BillingInfo)[]> {
  const numbers = [...new Set(contracts.map((c) => c.number_contract).filter(Boolean))];
  const rows: { number_contract: string; active: string; received: string; overdue: boolean }[] = numbers.length
    ? await AppDataSource.query(
        `SELECT number_contract,
                count(*) FILTER (WHERE status <> 'cancelled') AS active,
                COALESCE(sum(total_service_value) FILTER (WHERE status = 'received'), 0) AS received,
                bool_or(status = 'pending' AND expected_receipt_date ~ '^\\d{4}-\\d{2}-\\d{2}$'
                        AND expected_receipt_date < to_char((now() AT TIME ZONE 'America/Sao_Paulo')::date, 'YYYY-MM-DD')) AS overdue
           FROM billings
          WHERE tenant_id = $1 AND number_contract = ANY($2)
          GROUP BY number_contract`,
        [tenantId, numbers]
      )
    : [];
  const byNumber = new Map(rows.map((r) => [r.number_contract, { active: Number(r.active), received: Number(r.received), overdue: Boolean(r.overdue) }]));

  return contracts.map((c) => {
    const agg = byNumber.get(c.number_contract);
    return Object.assign(c, { billing_status: billingStatusOf(c, agg), billing_received: agg?.received ?? 0 });
  });
}
