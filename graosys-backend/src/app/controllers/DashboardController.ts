import { Request, Response } from "express";
import { AppDataSource } from "../../database/data-source";
import { GrainContract } from "../entities/GrainContract";
import { Client } from "../entities/Client";
import { Billing } from "../entities/Billing";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const num = (v: unknown) => Number(v ?? 0);

export class DashboardController {
  // Visão gerencial da corretora. Toda consulta filtra por tenant_id do token (nunca do cliente).
  async getManagement(req: Request, res: Response) {
    const { tenant_id } = req.user;
    const { from, to, crop, product } = req.query as Record<string, string>;
    const db = AppDataSource;

    // Data do contrato: emissão (texto ISO) ou, na falta, a data de criação.
    const D = `COALESCE(NULLIF(c.contract_emission_date, ''), to_char(c.created_at, 'YYYY-MM-DD'))`;
    const params: unknown[] = [tenant_id];
    let where = "c.tenant_id = $1";
    if (from && DATE_RE.test(from)) { params.push(from); where += ` AND ${D} >= $${params.length}`; }
    if (to && DATE_RE.test(to)) { params.push(to); where += ` AND ${D} <= $${params.length}`; }
    if (crop) { params.push(crop); where += ` AND c.crop = $${params.length}`; }
    if (product) { params.push(product); where += ` AND c.product = $${params.length}`; }
    const STATUS = `COALESCE(c.status->>'status_current', 'Sem status')`;

    const [totals] = await db.query(
      `SELECT count(*) AS contracts, coalesce(sum(c.quantity_kg), 0) AS volume_kg,
              coalesce(sum(c.commission_contract), 0) AS commission_total,
              coalesce(sum(c.commission_seller_contract_value), 0) AS commission_seller,
              coalesce(sum(c.commission_buyer_contract_value), 0) AS commission_buyer,
              count(*) FILTER (WHERE ${STATUS} IN ('Ativo', 'Em Execução')) AS open_contracts
       FROM grain_contracts c WHERE ${where}`, params);

    const valueByCurrency = await db.query(
      `SELECT c.type_currency AS currency, coalesce(sum(c.total_contract_value), 0) AS total, count(*) AS contracts
       FROM grain_contracts c WHERE ${where} GROUP BY 1 ORDER BY 2 DESC`, params);

    const byMonth = await db.query(
      `SELECT substr(${D}, 1, 7) AS month, count(*) AS contracts, coalesce(sum(c.quantity_kg), 0) AS volume_kg,
              coalesce(sum(c.commission_contract), 0) AS commission
       FROM grain_contracts c WHERE ${where} GROUP BY 1 ORDER BY 1 DESC LIMIT 12`, params);

    const byProduct = await db.query(
      `SELECT c.name_product AS product, count(*) AS contracts, coalesce(sum(c.quantity_kg), 0) AS volume_kg,
              coalesce(sum(c.commission_contract), 0) AS commission
       FROM grain_contracts c WHERE ${where} GROUP BY 1 ORDER BY 3 DESC, 2 DESC LIMIT 8`, params);

    const byStatus = await db.query(
      `SELECT ${STATUS} AS status, count(*) AS contracts FROM grain_contracts c WHERE ${where} GROUP BY 1 ORDER BY 2 DESC`, params);

    const party = (col: "seller" | "buyer") => db.query(
      `SELECT p AS name, count(*) AS contracts, coalesce(sum(c.quantity_kg), 0) AS volume_kg
       FROM grain_contracts c, jsonb_array_elements_text(coalesce(c.${col}, '[]'::jsonb)) AS p
       WHERE ${where} GROUP BY p ORDER BY 2 DESC, 3 DESC LIMIT 5`, params);
    const [topSellers, topBuyers] = await Promise.all([party("seller"), party("buyer")]);

    const byOwner = await db.query(
      `SELECT coalesce(nullif(c.owner_contract, ''), 'Não informado') AS owner, count(*) AS contracts,
              coalesce(sum(c.commission_contract), 0) AS commission
       FROM grain_contracts c WHERE ${where} GROUP BY 1 ORDER BY 2 DESC LIMIT 6`, params);

    const [recv] = await db.query(
      `SELECT coalesce(sum(liquid_value) FILTER (WHERE status = 'received'), 0) AS received,
              coalesce(sum(liquid_value) FILTER (WHERE status = 'pending'), 0) AS pending,
              coalesce(sum(liquid_value) FILTER (WHERE status = 'pending' AND expected_receipt_date < to_char(now(), 'YYYY-MM-DD') AND expected_receipt_date <> ''), 0) AS overdue,
              count(*) FILTER (WHERE status = 'pending' AND expected_receipt_date < to_char(now(), 'YYYY-MM-DD') AND expected_receipt_date <> '') AS overdue_count
       FROM billings WHERE tenant_id = $1`, [tenant_id]);

    const [clients] = await db.query(
      `SELECT count(*) FILTER (WHERE situation = 'active') AS active, count(*) AS total FROM clients WHERE tenant_id = $1`, [tenant_id]);

    const rows = (r: any[]) => r.map((x) => Object.fromEntries(Object.entries(x).map(([k, v]) => [k, typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v) && k !== "month" && k !== "name" && k !== "product" && k !== "owner" && k !== "status" && k !== "currency" ? Number(v) : v])));
    return res.json({
      kpis: {
        contracts: num(totals.contracts), open_contracts: num(totals.open_contracts), volume_kg: num(totals.volume_kg),
        commission_total: num(totals.commission_total), commission_seller: num(totals.commission_seller), commission_buyer: num(totals.commission_buyer),
        active_clients: num(clients.active), total_clients: num(clients.total),
      },
      value_by_currency: rows(valueByCurrency),
      by_month: rows(byMonth).reverse(),
      by_product: rows(byProduct),
      by_status: rows(byStatus),
      top_sellers: rows(topSellers),
      top_buyers: rows(topBuyers),
      by_owner: rows(byOwner),
      receivables: { received: num(recv.received), pending: num(recv.pending), overdue: num(recv.overdue), overdue_count: num(recv.overdue_count) },
    });
  }

  async getSummary(req: Request, res: Response) {
    const { tenant_id } = req.user;
    const { year = new Date().getFullYear().toString() } = req.query;

    const contractRepo = AppDataSource.getRepository(GrainContract);
    const clientRepo = AppDataSource.getRepository(Client);
    const billingRepo = AppDataSource.getRepository(Billing);

    const [totalContracts, activeClients] = await Promise.all([
      contractRepo.count({ where: { tenant_id } }),
      clientRepo.count({ where: { tenant_id, situation: "active" } }),
    ]);

    const billings = await billingRepo.find({ where: { tenant_id, year: String(year) } });

    const totalReceived = billings.filter(b => b.status === "received").reduce((s, b) => s + Number(b.liquid_value), 0);
    const totalPending = billings.filter(b => b.status === "pending").reduce((s, b) => s + Number(b.liquid_value), 0);

    const recentContracts = await contractRepo.find({
      where: { tenant_id },
      order: { created_at: "DESC" },
      take: 5,
    });

    return res.json({
      kpis: { totalContracts, activeClients, totalReceived, totalPending },
      recentContracts,
    });
  }
}
