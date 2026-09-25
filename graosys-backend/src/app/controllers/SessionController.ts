import { Request, Response } from "express";
import { AppDataSource } from "../../database/data-source";
import { User } from "../entities/User";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { v4 as uuid } from "uuid";
import { UserSession } from "../entities/UserSession";
import { writeAudit, clientIp, userAgent } from "../../services/audit";
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

    const failed = (reason: string) =>
      writeAudit({
        tenant_id: user?.tenant_id ?? null,
        user_id: user?.id ?? null,
        user_name: user?.name ?? null,
        user_email: String(email).slice(0, 255),
        action: "auth.login_failed",
        entity: "auth",
        method: "POST",
        path: "/api/auth/login",
        status_code: 401,
        metadata: { reason },
        ip: clientIp(req),
        user_agent: userAgent(req),
      });

    if (!user || !user.active) {
      await failed(user ? "user_inactive" : "unknown_user");
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      await failed("wrong_password");
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    if (user.tenant?.status === "suspended") {
      await failed("tenant_suspended");
      return res.status(403).json({ error: "Conta suspensa. Entre em contato com o suporte." });
    }

    await userRepo.update(user.id, { last_login_at: new Date() });

    const sid = uuid();
    const sessionRepo = AppDataSource.getRepository(UserSession);
    // Horários vêm do relógio do banco (now()), para não depender do fuso do servidor Node.
    await sessionRepo.createQueryBuilder().insert().values({
      id: sid, tenant_id: user.tenant_id, user_id: user.id, user_name: user.name, user_email: user.email, role: user.role,
      ip: clientIp(req), user_agent: userAgent(req), expires_at: () => "now() + interval '8 hours'",
    }).execute();
    await writeAudit({
      tenant_id: user.tenant_id, user_id: user.id, user_name: user.name, user_email: user.email,
      action: "auth.login", entity: "auth", method: "POST", path: "/api/auth/login", status_code: 200,
      metadata: { session_id: sid }, ip: clientIp(req), user_agent: userAgent(req),
    });

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
        sid,
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

  // Batimento do frontend (a cada ~60 s): marca a sessão como ativa.
  async heartbeat(req: Request, res: Response) {
    const { sid, id, tenant_id } = req.user;
    if (sid) {
      await AppDataSource.getRepository(UserSession).createQueryBuilder().update()
        .set({ last_seen_at: () => "now()" })
        .where("id = :sid AND user_id = :id AND tenant_id = :tenant_id AND ended_at IS NULL", { sid, id, tenant_id })
        .execute();
    }
    return res.status(204).send();
  }

  async logout(req: Request, res: Response) {
    const { sid, id, tenant_id } = req.user;
    if (sid) {
      await AppDataSource.getRepository(UserSession).createQueryBuilder().update()
        .set({ ended_at: () => "now()", ended_reason: "logout" })
        .where("id = :sid AND user_id = :id AND tenant_id = :tenant_id AND ended_at IS NULL", { sid, id, tenant_id })
        .execute();
      await writeAudit({
        tenant_id, user_id: id, user_name: req.user.name, user_email: req.user.email, action: "auth.logout", entity: "auth",
        method: "POST", path: "/api/auth/logout", status_code: 204, metadata: { session_id: sid }, ip: clientIp(req), user_agent: userAgent(req),
      });
    }
    return res.status(204).send();
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
