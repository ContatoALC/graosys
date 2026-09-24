import { Request, Response } from "express";
import { AppDataSource } from "../../database/data-source";
import { User } from "../entities/User";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../../config/jwtSecret";

export class SessionController {
  async login(req: Request, res: Response) {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email e senha são obrigatórios" });
    }

    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({
      where: { email },
      relations: ["tenant"],
      select: {
        id: true, tenant_id: true, name: true, email: true, password: true,
        role: true, permissions: true, active: true,
      },
    });

    if (!user || !user.active) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    if (user.tenant?.status === "suspended") {
      return res.status(403).json({ error: "Conta suspensa. Entre em contato com o suporte." });
    }

    await userRepo.update(user.id, { last_login_at: new Date() });

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenant_id: user.tenant_id,
        tenant_slug: user.tenant?.slug,
        tenant_name: user.tenant?.name,
        permissions: user.permissions,
      },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenant_id: user.tenant_id,
        tenant_name: user.tenant?.name,
        permissions: user.permissions,
      },
    });
  }

  async resetPassword(req: Request, res: Response) {
    const { current_password, new_password } = req.body;
    const { id } = req.user;

    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({
      where: { id },
      select: { id: true, password: true },
    });

    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

    const match = await bcrypt.compare(current_password, user.password);
    if (!match) return res.status(400).json({ error: "Senha atual incorreta" });

    user.password = await bcrypt.hash(new_password, 10);
    await userRepo.save(user);

    return res.json({ message: "Senha alterada com sucesso" });
  }
}
