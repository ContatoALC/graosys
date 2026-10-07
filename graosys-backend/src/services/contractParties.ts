import { In } from "typeorm";
import { AppDataSource } from "../database/data-source";
import { Client } from "../app/entities/Client";
import { GrainContract } from "../app/entities/GrainContract";

const same = (a?: string | null, b?: string | null) => (a || "").trim().toLowerCase() === (b || "").trim().toLowerCase();
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 120) : undefined);

// Mantém seller_ids/buyer_ids alinhados aos nomes. Um id só vale se o cliente for da corretora e o nome
// gravado no contrato ainda for o dele; caso contrário vira null (nome digitado, sem cadastro).
export async function linkContractParties(tenantId: string, contract: GrainContract) {
  const sides = ["seller", "buyer"] as const;
  const wanted = new Set<string>();
  for (const side of sides) {
    for (const id of Array.isArray(contract[`${side}_ids`]) ? contract[`${side}_ids`] : []) {
      if (typeof id === "string" && id) wanted.add(id);
    }
  }
  const clients = wanted.size
    ? await AppDataSource.getRepository(Client).find({ where: { tenant_id: tenantId, id: In([...wanted]) }, select: ["id", "name", "nickname"] })
    : [];
  const byId = new Map(clients.map((c) => [c.id, c]));

  for (const side of sides) {
    const names = Array.isArray(contract[side]) ? contract[side] : [];
    const ids = Array.isArray(contract[`${side}_ids`]) ? contract[`${side}_ids`] : [];
    contract[`${side}_ids`] = names.map((name, i) => {
      const client = typeof ids[i] === "string" ? byId.get(ids[i] as string) : undefined;
      return client && (same(client.name, name) || same(client.nickname, name)) ? client.id : null;
    });
  }
}

// Conta de pagamento: só os campos conhecidos, como texto; vazia vira null.
export function normalizePaymentAccount(raw: unknown): GrainContract["payment_account"] {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const account = { bank: str(r.bank), agency: str(r.agency), account: str(r.account), pix: str(r.pix) };
  return Object.values(account).some(Boolean) ? account : null;
}

// Contas bancárias do cadastro de cliente: mesma limpeza, descartando linhas vazias.
export function normalizeBankAccounts(raw: unknown): object[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizePaymentAccount).filter((a): a is NonNullable<typeof a> => a !== null).slice(0, 20);
}

const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;

// E-mails do cadastro de cliente que recebem os contratos: { name?, email }, e-mail em minúsculas e sem repetidos.
// Devolve o primeiro endereço inválido em "invalid" para a mensagem de erro.
export function normalizeContacts(raw: unknown): { list: { name?: string; email: string }[]; invalid?: string } {
  if (!Array.isArray(raw)) return { list: [] };
  const list: { name?: string; email: string }[] = [];
  for (const item of raw) {
    const r = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const email = String(r.email ?? "").trim().toLowerCase();
    if (!email) continue; // linha em branco
    if (!EMAIL_RE.test(email) || email.length > 254) return { list: [], invalid: email };
    if (!list.some((c) => c.email === email)) list.push({ name: str(r.name), email });
  }
  return { list: list.slice(0, 20) };
}
