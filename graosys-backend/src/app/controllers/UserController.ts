import { Request, Response } from "express";
import { AppDataSource } from "../../database/data-source";
import { User } from "../entities/User";
import bcrypt from "bcrypt";

export class UserController {
  async create(req: Request, res: Response) {
    const { name, email, password, role, permissions } = req.body;
    const { tenant_id } = req.user;

    const userRepo = AppDataSource.getRepository(User);
    const existing = await userRepo.findOne({ where: { email, tenant_id } });
    if (existing) return res.status(400).json({ error: "Email já cadastrado nesta corretora" });

    const hashed = await bcrypt.hash(password, 10);
    const user = userRepo.create({ tenant_id, name, email, password: hashed, role: role || "user", permissions: permissions || {} });
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
    const { name, email, role, permissions, active } = req.body;
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

    Object.assign(user, { name, email, role, permissions, active });
    await userRepo.save(user);

    const { password: _, ...userData } = user;
    return res.json(userData);
  }

  async delete(req: Request, res: Response) {
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
    await userRepo.remove(user);
    return res.status(204).send();
  }
}
