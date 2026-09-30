import { Request, Response } from "express";
import { AppDataSource } from "../../database/data-source";
import { User } from "../entities/User";
import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { v4 as uuid } from "uuid";
import { UserSession } from "../entities/UserSession";
import { writeAudit, clientIp, userAgent } from "../../services/audit";
import { JWT_SECRET } from "../../config/jwtSecret";
import { accountBlockReason, endUserSessions, MIN_PASSWORD, normalizeEmail } from "../../services/accounts";
import { sendPlatformEmail } from "../../services/platformMailer";

const FAILURE_WINDOW = "15 minutes";
const MAX_FAILURES_PER_EMAIL = 8;
const MAX_FAILURES_PER_IP = 30;
const RESET_TOKEN_TTL = "1 hour";

// Limite de tentativas a partir da própria trilha de auditoria: funciona em serverless (sem memória compartilhada).
// Tentativas barradas por conta suspensa/vencida (403) não contam: a senha estava certa.
async function tooManyFailures(email: string, ip: string | null): Promise<boolean> {
  const [row] = await AppDataSource.query(
    `SELECT count(*) FILTER (WHERE user_email = $1) AS by_email, count(*) FILTER (WHERE ip = $2) AS by_ip
       FROM audit_logs
      WHERE action = 'auth.login_failed' AND status_code = 401 AND created_at > now() - $3::interval`,
    [email, ip, FAILURE_WINDOW]
  );
  return Number(row?.by_email) >= MAX_FAILURES_PER_EMAIL || Number(row?.by_ip) >= MAX_FAILURES_PER_IP;
}

const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export class SessionController {
  async login(req: Request, res: Response) {
    const { password } = req.body;
    const email = normalizeEmail(req.body.email);

    if (!email || !password) {
      return res.status(400).json({ error: "Email e senha são obrigatórios" });
    }

    const ip = clientIp(req);
    if (await tooManyFailures(email, ip)) {
      await writeAudit({
        user_email: email.slice(0, 255), action: "auth.login_throttled", entity: "auth", method: "POST",
        path: "/api/auth/login", status_code: 429, metadata: {}, ip, user_agent: userAgent(req),
      });
      return res.status(429).json({ error: "Muitas tentativas de login. Aguarde 15 minutos ou use \"Esqueci minha senha\"." });
    }

    // Enquanto houver e-mails repetidos de antes da unicidade, vale o cadastro cuja senha confere.
    const userRepo = AppDataSource.getRepository(User);
    const candidates = await userRepo.createQueryBuilder("u")
      .leftJoinAndSelect("u.tenant", "tenant")
      .addSelect("u.password")
      .where("LOWER(u.email) = :email", { email })
      .getMany();
    let user: User | undefined;
    for (const c of candidates) {
      if (await bcrypt.compare(String(password), c.password)) { user = c; break; }
    }
    const known = user || candidates[0];

    const failed = (reason: string, status = 401) =>
      writeAudit({
        tenant_id: known?.tenant_id ?? null,
        user_id: known?.id ?? null,
        user_name: known?.name ?? null,
        user_email: email.slice(0, 255),
        action: "auth.login_failed",
        entity: "auth",
        method: "POST",
        path: "/api/auth/login",
        status_code: status,
        metadata: { reason },
        ip,
        user_agent: userAgent(req),
      });

    if (!user) {
      await failed(candidates.length ? "wrong_password" : "unknown_user");
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    const blocked = accountBlockReason({
      role: user.role, user_active: user.active, tenant_status: user.tenant?.status ?? null, plan_expires_at: user.tenant?.plan_expires_at ?? null,
    });
    if (blocked) {
      await failed("account_blocked", 403);
      return res.status(403).json({ error: blocked });
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

    const [broker] = await AppDataSource.query(
      `SELECT id FROM brokers WHERE tenant_id = $1 AND user_id = $2 AND active = true LIMIT 1`, [user.tenant_id, user.id]
    );

    return res.json({
      token,
      user: {
        broker_id: broker?.id ?? null,
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
    const { id, sid } = req.user;
    if (!new_password || String(new_password).length < MIN_PASSWORD) {
      return res.status(400).json({ error: `A nova senha deve ter no mínimo ${MIN_PASSWORD} caracteres` });
    }

    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({
      where: { id },
      select: { id: true, password: true },
    });

    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

    const match = await bcrypt.compare(String(current_password ?? ""), user.password);
    if (!match) return res.status(400).json({ error: "Senha atual incorreta" });

    user.password = await bcrypt.hash(new_password, 10);
    await userRepo.save(user);
    // Encerra as outras sessões abertas; a atual continua.
    await AppDataSource.query(
      `UPDATE user_sessions SET ended_at = now(), ended_reason = 'password_changed' WHERE user_id = $1 AND ended_at IS NULL AND id <> $2`,
      [id, sid || ""]
    );

    return res.json({ message: "Senha alterada com sucesso" });
  }

  // Público. Resposta sempre igual, exista ou não o e-mail, para não revelar quem tem conta.
  async forgotPassword(req: Request, res: Response) {
    const email = normalizeEmail(req.body.email);
    const ok = () => res.json({ message: "Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha." });
    if (!email) return res.status(400).json({ error: "Informe o e-mail" });

    const frontendUrl = (process.env.FRONTEND_URL || (process.env.NODE_ENV === "production" ? "" : "http://localhost:5173")).replace(/\/+$/, "");
    if (!frontendUrl) {
      console.error("FRONTEND_URL não configurado: link de redefinição de senha não pode ser gerado.");
      return ok();
    }

    const ip = clientIp(req);
    const [recent] = await AppDataSource.query(
      `SELECT count(*) FILTER (WHERE user_email = $1) AS by_email, count(*) FILTER (WHERE ip = $2) AS by_ip
         FROM audit_logs WHERE action = 'auth.password_reset_requested' AND created_at > now() - interval '1 hour'`,
      [email, ip]
    );
    const audit = (tenant_id: string | null, user_id: string | null, sent: boolean) =>
      writeAudit({
        tenant_id, user_id, user_email: email.slice(0, 255), action: "auth.password_reset_requested", entity: "auth",
        method: "POST", path: "/api/auth/forgot-password", status_code: 200, metadata: { sent }, ip, user_agent: userAgent(req),
      });
    if (Number(recent?.by_email) >= 3 || Number(recent?.by_ip) >= 20) {
      await audit(null, null, false);
      return ok();
    }

    const users = await AppDataSource.getRepository(User).createQueryBuilder("u")
      .where("LOWER(u.email) = :email AND u.active = true", { email }).getMany();
    if (!users.length) {
      await audit(null, null, false);
      return ok();
    }

    for (const user of users) {
      const token = crypto.randomBytes(32).toString("base64url");
      await AppDataSource.query(
        `UPDATE users SET reset_token_hash = $2, reset_token_expires_at = now() + $3::interval WHERE id = $1`,
        [user.id, hashToken(token), RESET_TOKEN_TTL]
      );
      const link = `${frontendUrl}/reset-password?token=${token}`;
      try {
        await sendPlatformEmail(user.email, "Redefinição de senha - GraoSys", {
          preheader: "Use o link para criar uma nova senha. Ele vale por 1 hora.",
          title: "Redefinição de senha",
          paragraphs: [
            `Olá, ${user.name}.`,
            "Recebemos um pedido para redefinir a sua senha no GraoSys. Para criar uma nova senha, use o botão abaixo. O link vale por 1 hora e só pode ser usado uma vez.",
          ],
          button: { label: "Criar nova senha", url: link },
          note: "Se não foi você que pediu, ignore este e-mail: a sua senha atual continua valendo.",
        });
        await audit(user.tenant_id, user.id, true);
      } catch (err) {
        console.error("Falha ao enviar e-mail de redefinição de senha:", (err as Error).message);
        await audit(user.tenant_id, user.id, false);
      }
    }
    return ok();
  }

  // Público. Troca a senha a partir do link enviado por e-mail e encerra todas as sessões do usuário.
  async resetPasswordWithToken(req: Request, res: Response) {
    const { token, new_password } = req.body;
    if (!token) return res.status(400).json({ error: "Link inválido" });
    if (!new_password || String(new_password).length < MIN_PASSWORD) {
      return res.status(400).json({ error: `A nova senha deve ter no mínimo ${MIN_PASSWORD} caracteres` });
    }

    const [user] = await AppDataSource.query(
      `SELECT id, tenant_id, name, email FROM users WHERE reset_token_hash = $1 AND reset_token_expires_at > now()`,
      [hashToken(String(token))]
    );
    if (!user) return res.status(400).json({ error: "Link inválido ou expirado. Peça um novo em \"Esqueci minha senha\"." });

    await AppDataSource.query(
      `UPDATE users SET password = $2, reset_token_hash = NULL, reset_token_expires_at = NULL WHERE id = $1`,
      [user.id, await bcrypt.hash(String(new_password), 10)]
    );
    await endUserSessions(user.id, "password_reset");
    await writeAudit({
      tenant_id: user.tenant_id, user_id: user.id, user_name: user.name, user_email: user.email, action: "auth.password_reset",
      entity: "auth", method: "POST", path: "/api/auth/reset-password-token", status_code: 200, metadata: {},
      ip: clientIp(req), user_agent: userAgent(req),
    });
    return res.json({ message: "Senha redefinida. Entre com a nova senha." });
  }
}

