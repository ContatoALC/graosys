import { AppDataSource } from "../database/data-source";
import { User } from "../app/entities/User";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD = 8;

export const normalizeEmail = (email: unknown) => String(email ?? "").trim().toLowerCase();

// O login busca por e-mail sem tenant, então o e-mail precisa ser único na plataforma (sem diferenciar maiúsculas).
export async function emailInUse(email: string, exceptUserId?: string): Promise<boolean> {
  const qb = AppDataSource.getRepository(User).createQueryBuilder("u").where("LOWER(u.email) = :email", { email: normalizeEmail(email) });
  if (exceptUserId) qb.andWhere("u.id <> :id", { id: exceptUserId });
  return (await qb.getCount()) > 0;
}

export interface AccountState {
  role: string;
  user_active: boolean;
  tenant_status: string | null;
  plan_expires_at: Date | string | null;
}

// Motivo para barrar o acesso (login e requisições autenticadas), ou null se a conta pode usar o sistema.
// Superadmin nunca é barrado pelo estado da corretora, para poder corrigir cadastros e planos.
export function accountBlockReason(s: AccountState): string | null {
  if (!s.user_active) return "Usuário inativo. Fale com o administrador da sua corretora.";
  if (s.role === "superadmin") return null;
  if (s.tenant_status === "suspended") return "Conta suspensa. Entre em contato com o suporte.";
  if (s.tenant_status === "inactive") return "Conta inativa. Entre em contato com o suporte.";
  if (s.plan_expires_at && new Date(s.plan_expires_at).getTime() < Date.now()) {
    return `Plano vencido em ${new Date(s.plan_expires_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}. Entre em contato com o suporte para renovar.`;
  }
  return null;
}

export async function endUserSessions(userId: string, reason: string): Promise<void> {
  await AppDataSource.query(
    `UPDATE user_sessions SET ended_at = now(), ended_reason = $2 WHERE user_id = $1 AND ended_at IS NULL`,
    [userId, reason]
  );
}
