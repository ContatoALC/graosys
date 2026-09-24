import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../../config/jwtSecret";

interface TokenPayload {
  id: string;
  email: string;
  name: string;
  role: string;
  tenant_id: string;
  tenant_slug: string;
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

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Token não fornecido" });
  }

  const [, token] = authHeader.split(" ");
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    req.user = decoded;
    return next();
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
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
