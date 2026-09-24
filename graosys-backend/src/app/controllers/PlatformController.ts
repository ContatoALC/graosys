import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { AppDataSource } from "../../database/data-source";
import { Tenant } from "../entities/Tenant";
import { User } from "../entities/User";
import { PLAN_KEYS as PLANS, PLANS as PLAN_INFO, monthlyPrice } from "../../config/plans";

const STATUSES = ["active", "inactive", "suspended"];
const ROLES = ["admin", "user"];
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const tenantRepo = () => AppDataSource.getRepository(Tenant);
const userRepo = () => AppDataSource.getRepository(User);

// O login busca por e-mail sem tenant, então e-mail precisa ser único na plataforma.
async function emailInUse(email: string, exceptUserId?: string) {
  const u = await userRepo().findOne({ where: { email } });
  return Boolean(u && u.id !== exceptUserId);
}

function toDateOrNull(v: unknown): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? undefined : d;
}

export class PlatformController {
  async summary(_req: Request, res: Response) {
    const [row] = await AppDataSource.query(`
      SELECT
        (SELECT count(*) FROM tenants) AS tenants,
        (SELECT count(*) FROM tenants WHERE status = 'active') AS active,
        (SELECT count(*) FROM tenants WHERE status = 'suspended') AS suspended,
        (SELECT count(*) FROM tenants WHERE plan = 'trial') AS trial,
        (SELECT count(*) FROM tenants WHERE plan_expires_at IS NOT NULL AND plan_expires_at < now()) AS expired,
        (SELECT count(*) FROM users) AS users,
        (SELECT count(*) FROM grain_contracts) AS contracts
    `);
    const billable = await AppDataSource.query(`
      SELECT t.plan, (SELECT count(*) FROM users u WHERE u.tenant_id = t.id AND u.active) AS active_users
      FROM tenants t WHERE t.status = 'active'
        AND NOT EXISTS (SELECT 1 FROM users s WHERE s.tenant_id = t.id AND s.role = 'superadmin')
    `);
    const mrr = billable.reduce((sum: number, t: any) => sum + monthlyPrice(t.plan, Number(t.active_users)), 0);
    return res.json({ ...Object.fromEntries(Object.entries(row).map(([k, v]) => [k, Number(v)])), mrr });
  }

  async listTenants(req: Request, res: Response) {
    const search = String(req.query.search || "").trim();
    const rows = await AppDataSource.query(
      `SELECT t.*,
         (SELECT count(*) FROM users u WHERE u.tenant_id = t.id) AS users_count,
         (SELECT count(*) FROM clients c WHERE c.tenant_id = t.id) AS clients_count,
         (SELECT count(*) FROM grain_contracts g WHERE g.tenant_id = t.id) AS contracts_count,
         (SELECT max(u.last_login_at) FROM users u WHERE u.tenant_id = t.id) AS last_access
       FROM tenants t
       WHERE ($1::text = '' OR t.name ILIKE '%' || $1 || '%' OR t.slug ILIKE '%' || $1 || '%' OR t.email ILIKE '%' || $1 || '%')
       ORDER BY t.created_at DESC`,
      [search]
    );
    return res.json(
      rows.map((r: any) => ({
        ...r,
        users_count: Number(r.users_count),
        clients_count: Number(r.clients_count),
        max_users: PLAN_INFO[r.plan]?.max_users ?? null,
        contracts_count: Number(r.contracts_count),
      }))
    );
  }

  plans(_req: Request, res: Response) {
    return res.json(PLAN_INFO);
  }

  async getTenant(req: Request, res: Response) {
    const tenant = await tenantRepo().findOne({ where: { id: req.params.id } });
    if (!tenant) return res.status(404).json({ error: "Corretora não encontrada" });
    const users = await userRepo().find({
      where: { tenant_id: tenant.id },
      select: ["id", "name", "email", "role", "active", "last_login_at", "created_at"],
      order: { name: "ASC" },
    });
    const [m] = await AppDataSource.query(
      `SELECT (SELECT count(*) FROM clients WHERE tenant_id = $1) AS clients,
              (SELECT count(*) FROM grain_contracts WHERE tenant_id = $1) AS contracts,
              (SELECT count(*) FROM billings WHERE tenant_id = $1) AS billings`,
      [tenant.id]
    );
    return res.json({
      tenant,
      users,
      metrics: { clients: Number(m.clients), contracts: Number(m.contracts), billings: Number(m.billings), users: users.length },
    });
  }

  async createTenant(req: Request, res: Response) {
    const { name, slug, cnpj, email, phone, plan, plan_expires_at, admin_name, admin_email, admin_password } = req.body;

    if (!name || !slug || !admin_name || !admin_email || !admin_password) {
      return res.status(400).json({ error: "Nome, identificador e dados do administrador são obrigatórios" });
    }
    if (!SLUG_RE.test(slug) || slug.length < 3 || slug.length > 50) {
      return res.status(400).json({ error: "Identificador deve ter 3-50 caracteres: letras minúsculas, números e hífen" });
    }
    if (!EMAIL_RE.test(admin_email)) return res.status(400).json({ error: "E-mail do administrador inválido" });
    if (String(admin_password).length < 8) return res.status(400).json({ error: "Senha deve ter no mínimo 8 caracteres" });
    if (plan && !PLANS.includes(plan)) return res.status(400).json({ error: "Plano inválido" });
    const expires = toDateOrNull(plan_expires_at);
    if (plan_expires_at && expires === undefined) return res.status(400).json({ error: "Data de vencimento inválida" });

    if (await tenantRepo().findOne({ where: { slug } })) return res.status(400).json({ error: "Este identificador já está em uso" });
    if (await emailInUse(admin_email)) return res.status(400).json({ error: "Este e-mail de administrador já está em uso" });

    const tenant = await AppDataSource.transaction(async (tx) => {
      const t = await tx.getRepository(Tenant).save(
        tx.getRepository(Tenant).create({
          name, slug, cnpj: cnpj || null, email: email || null, phone: phone || null,
          status: "active", plan: plan || "trial", plan_expires_at: expires ?? null,
        })
      );
      await tx.getRepository(User).save(
        tx.getRepository(User).create({
          tenant_id: t.id, name: admin_name, email: admin_email,
          password: await bcrypt.hash(admin_password, 10), role: "admin", permissions: {}, active: true,
        })
      );
      return t;
    });
    return res.status(201).json(tenant);
  }

  async updateTenant(req: Request, res: Response) {
    const tenant = await tenantRepo().findOne({ where: { id: req.params.id } });
    if (!tenant) return res.status(404).json({ error: "Corretora não encontrada" });
    const { name, cnpj, email, phone, plan, status, plan_expires_at } = req.body;

    if (plan !== undefined && !PLANS.includes(plan)) return res.status(400).json({ error: "Plano inválido" });
    if (status !== undefined && !STATUSES.includes(status)) return res.status(400).json({ error: "Status inválido" });
    if (status !== undefined && status !== "active" && tenant.id === req.user.tenant_id) {
      return res.status(400).json({ error: "Você não pode suspender ou inativar a sua própria corretora" });
    }
    const expires = toDateOrNull(plan_expires_at);
    if (plan_expires_at !== undefined && plan_expires_at !== null && plan_expires_at !== "" && expires === undefined) {
      return res.status(400).json({ error: "Data de vencimento inválida" });
    }

    if (name !== undefined) tenant.name = name;
    if (cnpj !== undefined) tenant.cnpj = cnpj || null;
    if (email !== undefined) tenant.email = email || null;
    if (phone !== undefined) tenant.phone = phone || null;
    if (plan !== undefined) tenant.plan = plan;
    if (status !== undefined) tenant.status = status;
    if (expires !== undefined) tenant.plan_expires_at = expires;
    await tenantRepo().save(tenant);
    return res.json(tenant);
  }

  async createUser(req: Request, res: Response) {
    const tenant = await tenantRepo().findOne({ where: { id: req.params.id } });
    if (!tenant) return res.status(404).json({ error: "Corretora não encontrada" });
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) return res.status(400).json({ error: "Nome, e-mail e senha são obrigatórios" });
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "E-mail inválido" });
    if (String(password).length < 8) return res.status(400).json({ error: "Senha deve ter no mínimo 8 caracteres" });
    if (role !== undefined && !ROLES.includes(role)) return res.status(400).json({ error: "Perfil inválido" });
    if (await emailInUse(email)) return res.status(400).json({ error: "Este e-mail já está em uso" });

    const user = await userRepo().save(
      userRepo().create({ tenant_id: tenant.id, name, email, password: await bcrypt.hash(password, 10), role: role || "admin", permissions: {}, active: true })
    );
    const { password: _, ...data } = user;
    return res.status(201).json(data);
  }

  private async findManageableUser(req: Request, res: Response): Promise<User | null> {
    const user = await userRepo().findOne({ where: { id: req.params.id } });
    if (!user) { res.status(404).json({ error: "Usuário não encontrado" }); return null; }
    if (user.role === "superadmin") { res.status(403).json({ error: "Usuários superadmin não podem ser alterados por aqui" }); return null; }
    return user;
  }

  updateUser = async (req: Request, res: Response) => {
    const user = await this.findManageableUser(req, res);
    if (!user) return;
    const { name, email, role, active } = req.body;

    if (role !== undefined && !ROLES.includes(role)) return res.status(400).json({ error: "Perfil inválido" });
    if (email !== undefined) {
      if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "E-mail inválido" });
      if (await emailInUse(email, user.id)) return res.status(400).json({ error: "Este e-mail já está em uso" });
      user.email = email;
    }
    if (name !== undefined) user.name = name;
    if (role !== undefined) user.role = role;
    if (active !== undefined) user.active = Boolean(active);
    await userRepo().save(user);
    const { password: _, ...data } = user;
    return res.json(data);
  };

  resetUserPassword = async (req: Request, res: Response) => {
    const user = await this.findManageableUser(req, res);
    if (!user) return;
    const { new_password } = req.body;
    if (!new_password || String(new_password).length < 8) return res.status(400).json({ error: "Senha deve ter no mínimo 8 caracteres" });
    user.password = await bcrypt.hash(new_password, 10);
    await userRepo().save(user);
    return res.json({ message: "Senha redefinida com sucesso" });
  };
}
