import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../../config/jwtSecret";
import { AppDataSource } from "../../database/data-source";
import { accountBlockReason } from "../../services/accounts";

interface TokenPayload {
  id: string;
  email: string;
  name: string;
  role: string;
  tenant_id: string;
  tenant_slug: string;
  sid?: string;
  permissions: Record<string, string[]>;
  iat: number;
  exp: number;
}

declare global {
  namespace Express {
    interface Request {
      user: TokenPayload;
    }
  }
}

// Estado da conta por sessão, relido do banco a cada ACCOUNT_CACHE_MS: suspensão, vencimento do plano,
// usuário desativado, logout/reset de senha e mudança de perfil valem em até esse intervalo, sem esperar o token expirar.
const ACCOUNT_CACHE_MS = 30_000;
const accountCache = new Map<string, { expires: number; row: any }>();

async function loadAccount(user: TokenPayload): Promise<any> {
  const key = `${user.id}:${user.sid || ""}`;
  const hit = accountCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.row;
  const [row] = await AppDataSource.query(
    `SELECT u.active AS user_active, u.role, u.permissions, t.status AS tenant_status, t.plan_expires_at,
            s.ended_at AS session_ended_at, s.expires_at AS session_expires_at, (s.expires_at < now()) AS session_expired
       FROM users u
       LEFT JOIN tenants t ON t.id = u.tenant_id
       LEFT JOIN user_sessions s ON s.id = $2 AND s.user_id = u.id
      WHERE u.id = $1 AND u.tenant_id = $3`,
    [user.id, user.sid || null, user.tenant_id]
  );
  if (accountCache.size > 5000) accountCache.clear();
  accountCache.set(key, { expires: Date.now() + ACCOUNT_CACHE_MS, row: row || null });
  return row || null;
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Token não fornecido" });
  }

  const [, token] = authHeader.split(" ");
  let decoded: TokenPayload;
  try {
    decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }

  const account = await loadAccount(decoded);
  if (!account) return res.status(401).json({ error: "Usuário não encontrado" });
  if (decoded.sid && (account.session_ended_at || account.session_expired)) {
    return res.status(401).json({ error: "Sessão encerrada. Entre novamente." });
  }
  const blocked = accountBlockReason(account);
  if (blocked) return res.status(401).json({ error: blocked });

  // Perfil e permissões vêm do banco, não do token: um rebaixamento vale sem esperar novo login.
  req.user = { ...decoded, role: account.role, permissions: account.permissions || {} };
  return next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.user.role !== "superadmin" && !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Acesso negado" });
    }
    return next();
  };
}

export const requireSuperadmin = requireRole("superadmin");

export function requirePermission(module: string, action: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.user.role === "admin" || req.user.role === "superadmin") return next();
    const modulePermissions = req.user.permissions?.[module] || [];
    if (!modulePermissions.includes(action)) {
      return res.status(403).json({ error: "Você não tem permissão para esta ação" });
    }
    return next();
  };
}
