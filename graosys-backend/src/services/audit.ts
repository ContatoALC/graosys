import { Request } from "express";
import { AppDataSource } from "../database/data-source";
import { AuditLog } from "../app/entities/AuditLog";

export function clientIp(req: Request): string | null {
  const fwd = req.headers["x-forwarded-for"];
  const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(",")[0]?.trim();
  return (first || req.socket?.remoteAddress || null)?.slice(0, 64) ?? null;
}

export function userAgent(req: Request): string | null {
  return (req.headers["user-agent"] as string | undefined)?.slice(0, 255) ?? null;
}

// A auditoria nunca pode derrubar a requisição: falhas são apenas logadas.
export async function writeAudit(entry: Partial<AuditLog>): Promise<void> {
  try {
    const repo = AppDataSource.getRepository(AuditLog);
    await repo.save(repo.create(entry));
  } catch (e) {
    console.error("Falha ao gravar auditoria:", (e as Error).message);
  }
}
