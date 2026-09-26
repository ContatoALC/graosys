import { Request } from "express";
import { AppDataSource } from "../database/data-source";
import { AuditLog } from "../app/entities/AuditLog";

// Cabeçalhos de proxy só são confiáveis atrás de um proxy que os reescreve (Vercel, ou TRUST_PROXY=true);
// fora disso qualquer cliente poderia forjar o IP gravado na auditoria.
const TRUST_PROXY = !!process.env.VERCEL || process.env.TRUST_PROXY === "true";

function header(req: Request, name: string): string | undefined {
  const v = req.headers[name];
  return (Array.isArray(v) ? v[0] : v)?.split(",")[0]?.trim() || undefined;
}

// "::1" → "127.0.0.1" e "::ffff:1.2.3.4" → "1.2.3.4" (IPv4 mapeado em IPv6).
function normalizeIp(ip: string): string {
  if (ip === "::1") return "127.0.0.1";
  return ip.replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/i, "");
}

export function clientIp(req: Request): string | null {
  const forwarded = TRUST_PROXY
    ? header(req, "x-vercel-forwarded-for") || header(req, "x-real-ip") || header(req, "x-forwarded-for")
    : undefined;
  const ip = forwarded || req.socket?.remoteAddress;
  return ip ? normalizeIp(ip).slice(0, 64) : null;
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
