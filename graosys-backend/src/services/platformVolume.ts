import { AppDataSource } from "../database/data-source";

// Volume negociado na plataforma: contratos, toneladas e valor por corretora, por mês e por produto.
// Data do contrato: emissão (texto ISO) ou, na falta, a data de criação. Cancelados não entram no volume,
// só na contagem de cancelados. A corretora interna (a que tem usuário superadmin) fica de fora por padrão,
// como no MRR, para dados de teste/demonstração não inflarem os números.
// Valor: só contratos em R$ (o valor fica na moeda do contrato); os em US$ vêm somados à parte.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const D = `COALESCE(NULLIF(c.contract_emission_date, ''), to_char(c.created_at, 'YYYY-MM-DD'))`;
const CANCELLED = `COALESCE(c.status->>'status_current', '') = 'Cancelado'`;
const INTERNAL = `EXISTS (SELECT 1 FROM users s WHERE s.tenant_id = t.id AND s.role = 'superadmin')`;
const TODAY = `(now() AT TIME ZONE 'America/Sao_Paulo')::date`;
// Colunas de volume; `only` restringe as linhas somadas (ex.: não cancelados).
const volumeCols = (only = "TRUE") => `count(*) FILTER (WHERE ${only}) AS contracts,
            COALESCE(sum(c.quantity_kg) FILTER (WHERE ${only}), 0) AS kg,
            COALESCE(sum(c.total_contract_value) FILTER (WHERE ${only} AND COALESCE(c.type_currency, 'BRL') <> 'USD'), 0) AS value_brl,
            COALESCE(sum(c.total_contract_value) FILTER (WHERE ${only} AND c.type_currency = 'USD'), 0) AS value_usd`;

// Corretora ativa sem lançar contrato há mais que isso entra no alerta.
export const INACTIVE_DAYS = 30;

export interface VolumeFilter {
  from?: string;
  to?: string;
  includeInternal?: boolean;
}

const round1 = (v: number) => Math.round(v * 10) / 10;
const round2 = (v: number) => Math.round(v * 100) / 100;
const volume = (r: any) => ({
  contracts: Number(r.contracts),
  tons: round1(Number(r.kg) / 1000),
  value_brl: round2(Number(r.value_brl)),
  value_usd: round2(Number(r.value_usd)),
});

export async function platformVolume(f: VolumeFilter) {
  const params: unknown[] = [];
  let where = "TRUE";
  if (f.from && DATE_RE.test(f.from)) { params.push(f.from); where += ` AND ${D} >= $${params.length}`; }
  if (f.to && DATE_RE.test(f.to)) { params.push(f.to); where += ` AND ${D} <= $${params.length}`; }
  if (!f.includeInternal) where += ` AND NOT ${INTERNAL}`;
  const from = `FROM grain_contracts c JOIN tenants t ON t.id = c.tenant_id`;

  const byTenant: any[] = await AppDataSource.query(
    `SELECT t.id AS tenant_id, t.name, ${INTERNAL} AS internal,
            count(*) FILTER (WHERE ${CANCELLED}) AS cancelled,
            max(${D}) FILTER (WHERE NOT ${CANCELLED}) AS last_contract_date,
            ${volumeCols(`NOT ${CANCELLED}`)}
       ${from}
      WHERE ${where}
      GROUP BY t.id, t.name
      ORDER BY kg DESC, contracts DESC`,
    params
  );

  const byMonth: any[] = await AppDataSource.query(
    `SELECT substr(${D}, 1, 7) AS month, ${volumeCols()}, count(DISTINCT c.tenant_id) AS tenants
       ${from}
      WHERE ${where} AND NOT ${CANCELLED}
      GROUP BY 1 ORDER BY 1`,
    params
  );

  const byProduct: any[] = await AppDataSource.query(
    `SELECT COALESCE(NULLIF(trim(c.name_product), ''), 'Sem produto') AS product, ${volumeCols()}
       ${from}
      WHERE ${where} AND NOT ${CANCELLED}
      GROUP BY 1 ORDER BY kg DESC, contracts DESC`,
    params
  );

  // Uso da plataforma: último contrato LANÇADO (created_at), independente do período filtrado.
  const inactive: any[] = await AppDataSource.query(
    `SELECT t.id AS tenant_id, t.name, t.created_at,
            to_char(max(c.created_at) AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS last_launch_date,
            ${TODAY} - COALESCE(max(c.created_at) AT TIME ZONE 'America/Sao_Paulo', t.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS days
       FROM tenants t
       LEFT JOIN grain_contracts c ON c.tenant_id = t.id
      WHERE t.status = 'active' ${f.includeInternal ? "" : `AND NOT ${INTERNAL}`}
      GROUP BY t.id, t.name, t.created_at
     HAVING max(c.created_at) IS NULL OR max(c.created_at) < now() - make_interval(days => ${INACTIVE_DAYS})
      ORDER BY days DESC`
  );

  const tenants = byTenant.map((r) => ({
    tenant_id: r.tenant_id,
    name: r.name,
    internal: Boolean(r.internal),
    cancelled: Number(r.cancelled),
    last_contract_date: r.last_contract_date,
    ...volume(r),
  }));

  return {
    totals: {
      contracts: tenants.reduce((s, t) => s + t.contracts, 0),
      cancelled: tenants.reduce((s, t) => s + t.cancelled, 0),
      tons: round1(byTenant.reduce((s, r) => s + Number(r.kg), 0) / 1000),
      value_brl: round2(byTenant.reduce((s, r) => s + Number(r.value_brl), 0)),
      value_usd: round2(byTenant.reduce((s, r) => s + Number(r.value_usd), 0)),
      tenants: tenants.filter((t) => t.contracts > 0).length,
    },
    tenants,
    monthly: byMonth.map((r) => ({ month: r.month, tenants: Number(r.tenants), ...volume(r) })),
    products: byProduct.map((r) => ({ product: r.product, ...volume(r) })),
    inactive: inactive.map((r) => ({
      tenant_id: r.tenant_id,
      name: r.name,
      last_launch_date: r.last_launch_date, // null = nunca lançou contrato
      days: Number(r.days),
    })),
    inactive_days: INACTIVE_DAYS,
  };
}
