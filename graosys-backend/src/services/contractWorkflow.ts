import { In } from "typeorm";
import { AppDataSource } from "../database/data-source";
import { GrainContract } from "../app/entities/GrainContract";
import { Tenant } from "../app/entities/Tenant";
import { withBillingStatus } from "./billingStatus";

// Fluxo do contrato como linha de montagem: cada status pertence a um departamento, e o contrato só
// passa adiante pelas ações abaixo (nunca escolhendo o status livremente).
//
//   Contratos: Em Elaboração ─► Execução: Em Análise ─► Aguardando Envio ─► [Em Embarque] ─► Cobrança ─► Concluído
//        ▲ Devolvido ◄──────────────────┘            (envio do e-mail)      (pós-venda)     (comissão recebida)
//   Cancelado: de qualquer etapa aberta, com motivo.

export type Department = "contracts" | "execution" | "billing" | "done" | "cancelled";

export const STAGES = {
  "Em Elaboração": "contracts",
  Devolvido: "contracts",
  "Em Análise": "execution",
  "Aguardando Envio": "execution",
  "Em Embarque": "execution",
  "Em Cobrança": "billing",
  Concluído: "done",
  Cancelado: "cancelled",
} as const satisfies Record<string, Department>;

export type Stage = keyof typeof STAGES;

export const CLOSED_STAGES: Stage[] = ["Concluído", "Cancelado"];
// Etapas em que o contrato já foi aprovado e pode ser (re)enviado ao cliente.
const SENDABLE_STAGES: Stage[] = ["Aguardando Envio", "Em Embarque", "Em Cobrança", "Concluído"];

export function stagesOf(department: string): Stage[] {
  return (Object.keys(STAGES) as Stage[]).filter((s) => STAGES[s] === department);
}

export type WorkflowAction = "submit" | "approve" | "return" | "ship_done" | "cancel" | "reopen";

interface ActionRule {
  from: Stage[];
  to: (ctx: { tenant: Tenant }) => Stage;
  reasonRequired?: boolean;
  adminOnly?: boolean;
}

const OPEN_STAGES = (Object.keys(STAGES) as Stage[]).filter((s) => !CLOSED_STAGES.includes(s));

const ACTIONS: Record<WorkflowAction, ActionRule> = {
  // Contratos → Execução. No fluxo simplificado (corretora de um operador) a análise é dispensada.
  submit: { from: ["Em Elaboração", "Devolvido"], to: ({ tenant }) => (tenant.workflow_mode === "simple" ? "Aguardando Envio" : "Em Análise") },
  approve: { from: ["Em Análise"], to: () => "Aguardando Envio" },
  return: { from: ["Em Análise", "Aguardando Envio"], to: () => "Devolvido", reasonRequired: true },
  ship_done: { from: ["Em Embarque"], to: () => "Em Cobrança" },
  cancel: { from: OPEN_STAGES, to: () => "Cancelado", reasonRequired: true },
  reopen: { from: ["Cancelado"], to: () => "Em Elaboração", reasonRequired: true, adminOnly: true },
};

export const WORKFLOW_ACTIONS = Object.keys(ACTIONS) as WorkflowAction[];

const MODULE_OF: Partial<Record<Department, string>> = { contracts: "contracts", execution: "execution", billing: "billing" };

interface Actor {
  name: string;
  role: string;
  permissions?: Record<string, string[]>;
}

const isAdmin = (u: Actor) => u.role === "admin" || u.role === "superadmin";

// Só quem trabalha no departamento da etapa atual (permissão de edição no módulo) move o contrato.
function canAct(user: Actor, stage: Stage): boolean {
  if (isAdmin(user)) return true;
  const module = MODULE_OF[STAGES[stage]];
  return !!module && (user.permissions?.[module] || []).includes("edit");
}

export function currentStage(contract: GrainContract): Stage | null {
  const s = contract.status?.status_current;
  return s && s in STAGES ? (s as Stage) : null;
}

export function pushStage(contract: GrainContract, stage: Stage, owner: string, extra: { action?: string; reason?: string } = {}): void {
  const now = new Date();
  const entry = {
    date: now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    time: now.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    at: now.toISOString(),
    status: stage,
    owner_change: owner,
    ...(extra.action ? { action: extra.action } : {}),
    ...(extra.reason ? { reason: extra.reason } : {}),
  };
  contract.status = { status_current: stage, history: [...(contract.status?.history || []), entry] };
}

// Status de um contrato novo (criado ou clonado).
export function startWorkflow(contract: GrainContract, tenant: Tenant | null, owner: string): void {
  contract.status = null as any;
  if (tenant?.workflow_mode === "simple") {
    pushStage(contract, "Aguardando Envio", owner, { action: "create", reason: "Fluxo simplificado: análise dispensada" });
  } else {
    pushStage(contract, "Em Elaboração", owner, { action: "create" });
  }
}

export type TransitionError = { status: number; error: string };

export function applyAction(contract: GrainContract, tenant: Tenant, user: Actor, action: string, reason?: unknown): TransitionError | null {
  const rule = ACTIONS[action as WorkflowAction];
  if (!rule) return { status: 400, error: "Ação inválida" };
  const stage = currentStage(contract);
  if (!stage || !rule.from.includes(stage)) {
    return { status: 409, error: `Ação não disponível para um contrato em "${contract.status?.status_current ?? "sem status"}"` };
  }
  if (rule.adminOnly ? !isAdmin(user) : !canAct(user, stage)) {
    return { status: 403, error: "Você não tem permissão para mover contratos nesta etapa" };
  }
  const text = typeof reason === "string" ? reason.trim().slice(0, 500) : "";
  if (rule.reasonRequired && !text) return { status: 400, error: "Informe o motivo" };
  pushStage(contract, rule.to({ tenant }), user.name, { action, reason: text || undefined });
  return null;
}

// Envio por e-mail: só sai contrato aprovado pela Execução.
export function sendBlockedReason(contract: GrainContract): string | null {
  const stage = currentStage(contract);
  if (stage && SENDABLE_STAGES.includes(stage)) return null;
  if (stage === "Cancelado") return "Contrato cancelado não pode ser enviado";
  return "O contrato precisa ser aprovado pela Execução antes do envio";
}

// Primeiro envio bem-sucedido: sai da Execução para a Cobrança, ou para o Embarque quando há pós-venda.
export function afterSent(contract: GrainContract, owner: string): boolean {
  if (currentStage(contract) !== "Aguardando Envio") return false;
  pushStage(contract, contract.track_shipment ? "Em Embarque" : "Em Cobrança", owner, { action: "send" });
  return true;
}

// Recebimentos mudaram: contrato em cobrança com a comissão toda recebida é concluído (e volta se deixar de estar).
export async function syncBillingStage(tenantId: string, numbers: (string | null | undefined)[], owner: string): Promise<void> {
  const list = [...new Set(numbers.filter((n): n is string => !!n))];
  if (list.length === 0) return;
  const repo = AppDataSource.getRepository(GrainContract);
  const contracts = await repo.find({ where: { tenant_id: tenantId, number_contract: In(list) } });
  for (const c of await withBillingStatus(tenantId, contracts)) {
    const stage = currentStage(c);
    if (stage === "Em Cobrança" && c.billing_status === "Recebido") {
      pushStage(c, "Concluído", owner, { action: "billing", reason: "Comissão recebida" });
    } else if (stage === "Concluído" && c.billing_status !== "Recebido") {
      pushStage(c, "Em Cobrança", owner, { action: "billing", reason: "Comissão deixou de estar totalmente recebida" });
    } else continue;
    await repo.update({ id: c.id, tenant_id: tenantId }, { status: c.status });
  }
}
