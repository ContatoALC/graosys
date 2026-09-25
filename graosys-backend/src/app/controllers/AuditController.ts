import { Request, Response } from "express";
import { AppDataSource } from "../../database/data-source";
import { AuditLog } from "../entities/AuditLog";
import { sessionsOverview } from "../../services/presence";

// Monta a consulta de auditoria. `tenantId` vem SEMPRE do token (corretora) ou de parâmetro validado (superadmin).
async function query(req: Request, res: Response, tenantId: string | null) {
  const { user_id, action, entity, from, to, result, search, page = "1", limit = "50" } = req.query as Record<string, string>;
  const pageN = Math.max(1, Number(page) || 1);
  const limitN = Math.min(100, Math.max(1, Number(limit) || 50));

  const qb = AppDataSource.getRepository(AuditLog).createQueryBuilder("a").orderBy("a.created_at", "DESC");
  if (tenantId) qb.where("a.tenant_id = :tenantId", { tenantId });
  else if (req.query.tenant_id) qb.where("a.tenant_id = :tid", { tid: String(req.query.tenant_id) });
  else qb.where("1 = 1");

  if (user_id) qb.andWhere("a.user_id = :user_id", { user_id });
  if (action) qb.andWhere("a.action LIKE :action ESCAPE '\\'", { action: `${action.replace(/[\\%_]/g, "\\$&")}%` });
  if (entity) qb.andWhere("a.entity = :entity", { entity });
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) qb.andWhere("a.created_at >= :from", { from });
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) qb.andWhere("a.created_at < (:to::date + 1)", { to });
  if (result === "ok") qb.andWhere("(a.status_code IS NULL OR a.status_code < 400)");
  if (result === "error") qb.andWhere("a.status_code >= 400");
  if (search) qb.andWhere("(a.user_name ILIKE :s OR a.user_email ILIKE :s OR a.entity_id ILIKE :s OR a.action ILIKE :s)", { s: `%${search}%` });

  const [rows, total] = await qb.skip((pageN - 1) * limitN).take(limitN).getManyAndCount();
  return res.json({ data: rows, total, page: pageN, limit: limitN });
}

async function actions(tenantId: string | null) {
  const rows = await AppDataSource.query(
    `SELECT DISTINCT action FROM audit_logs ${tenantId ? "WHERE tenant_id = $1" : ""} ORDER BY action`,
    tenantId ? [tenantId] : []
  );
  return rows.map((r: any) => r.action);
}

export class AuditController {
  // Corretora: sempre restrita ao tenant do usuário logado.
  list = (req: Request, res: Response) => query(req, res, req.user.tenant_id);
  actions = async (req: Request, res: Response) => res.json(await actions(req.user.tenant_id));
  sessions = async (req: Request, res: Response) => res.json(await sessionsOverview(req.user.tenant_id));

  // Plataforma (superadmin): todas as corretoras, com filtro opcional por tenant_id.
  platformList = (req: Request, res: Response) => query(req, res, null);
  platformActions = async (_req: Request, res: Response) => res.json(await actions(null));
  platformSessions = async (req: Request, res: Response) => {
    const tid = req.query.tenant_id ? String(req.query.tenant_id) : null;
    return res.json(await sessionsOverview(tid));
  };
}
