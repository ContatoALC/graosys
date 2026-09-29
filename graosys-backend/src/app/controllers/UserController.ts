import { Request, Response } from "express";
import { AppDataSource } from "../../database/data-source";
import { User } from "../entities/User";
import bcrypt from "bcrypt";
import { EMAIL_RE, MIN_PASSWORD, emailInUse, endUserSessions, normalizeEmail } from "../../services/accounts";

// A corretora só atribui estes perfis; superadmin é exclusivo da plataforma.
const ROLES = ["admin", "user"];

// Permissões: { módulo: ["view", "create", ...] }, só strings.
function sanitizePermissions(v: unknown): Record<string, string[]> | undefined {
  if (v === undefined) return undefined;
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, string[]> = {};
  for (const [mod, actions] of Object.entries(v as Record<string, unknown>)) {
    if (Array.isArray(actions)) out[mod] = actions.filter((a): a is string => typeof a === "string");
  }
  return out;
}

// Usuários superadmin só são alterados por um superadmin.
function canManage(req: Request, user: User) {
  return user.role !== "superadmin" || req.user.role === "superadmin";
}

export class UserController {
  async create(req: Request, res: Response) {
    const { name, password, role } = req.body;
    const email = normalizeEmail(req.body.email);
    const { tenant_id } = req.user;

    if (!name || !email || !password) return res.status(400).json({ error: "Nome, e-mail e senha são obrigatórios" });
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "E-mail inválido" });
    if (String(password).length < MIN_PASSWORD) return res.status(400).json({ error: `Senha deve ter no mínimo ${MIN_PASSWORD} caracteres` });
    if (role !== undefined && !ROLES.includes(role)) return res.status(400).json({ error: "Perfil inválido" });
    if (await emailInUse(email)) return res.status(400).json({ error: "Este e-mail já está em uso" });

    const userRepo = AppDataSource.getRepository(User);
    const hashed = await bcrypt.hash(password, 10);
    const user = userRepo.create({ tenant_id, name, email, password: hashed, role: role || "user", permissions: sanitizePermissions(req.body.permissions) || {} });
    await userRepo.save(user);

    const { password: _, ...userData } = user;
    return res.status(201).json(userData);
  }

  async getAll(req: Request, res: Response) {
    const userRepo = AppDataSource.getRepository(User);
    const users = await userRepo.find({
      where: { tenant_id: req.user.tenant_id },
      select: ["id", "name", "email", "role", "active", "permissions", "created_at"],
      order: { name: "ASC" },
    });
    return res.json(users);
  }

  async getById(req: Request, res: Response) {
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({
      where: { id: req.params.id, tenant_id: req.user.tenant_id },
      select: ["id", "name", "email", "role", "active", "permissions", "created_at"],
    });
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
    return res.json(user);
  }

  async getProfile(req: Request, res: Response) {
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({
      where: { id: req.user.id },
      select: ["id", "name", "email", "role", "active", "permissions"],
      relations: ["tenant"],
    });
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
    return res.json(user);
  }

  async update(req: Request, res: Response) {
    const { name, email, role, active, password } = req.body;
    const permissions = sanitizePermissions(req.body.permissions);
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
    if (!canManage(req, user)) return res.status(403).json({ error: "Este usuário não pode ser alterado por aqui" });

    const isSelf = user.id === req.user.id;
    if (role !== undefined && role !== user.role) {
      if (!ROLES.includes(role)) return res.status(400).json({ error: "Perfil inválido" });
      if (isSelf) return res.status(400).json({ error: "Você não pode alterar o seu próprio perfil" });
      user.role = role;
    }
    if (active !== undefined && Boolean(active) !== user.active) {
      if (isSelf) return res.status(400).json({ error: "Você não pode desativar o seu próprio usuário" });
      user.active = Boolean(active);
    }
    if (email !== undefined) {
      const normalized = normalizeEmail(email);
      if (!EMAIL_RE.test(normalized)) return res.status(400).json({ error: "E-mail inválido" });
      if (await emailInUse(normalized, user.id)) return res.status(400).json({ error: "Este e-mail já está em uso" });
      user.email = normalized;
    }
    if (name !== undefined) user.name = name;
    if (permissions !== undefined) user.permissions = permissions;
    // Nova senha definida pelo administrador (opcional).
    if (password) {
      if (String(password).length < MIN_PASSWORD) return res.status(400).json({ error: `Senha deve ter no mínimo ${MIN_PASSWORD} caracteres` });
      user.password = await bcrypt.hash(password, 10);
    }
    await userRepo.save(user);
    if (password || !user.active) await endUserSessions(user.id, password ? "password_reset" : "user_deactivated");

    const { password: _, ...userData } = user;
    return res.json(userData);
  }

  async delete(req: Request, res: Response) {
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
    if (!canManage(req, user)) return res.status(403).json({ error: "Este usuário não pode ser removido por aqui" });
    if (user.id === req.user.id) return res.status(400).json({ error: "Você não pode excluir o seu próprio usuário" });
    await userRepo.remove(user);
    return res.status(204).send();
  }
}
