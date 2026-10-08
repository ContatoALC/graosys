// Fluxo do contrato por departamento (espelha graosys-backend/src/services/contractWorkflow.ts).
// Cada status pertence a um departamento; a cor do selo é a do departamento.

export type Department = "contracts" | "execution" | "billing" | "done" | "cancelled";

export const STAGE_DEPARTMENT: Record<string, Department> = {
  "Em Elaboração": "contracts",
  Devolvido: "contracts",
  "Em Análise": "execution",
  "Aguardando Envio": "execution",
  "Em Embarque": "execution",
  "Em Cobrança": "billing",
  Concluído: "done",
  Cancelado: "cancelled",
};

export const DEPARTMENTS: Record<Department, { label: string; badge: string; dot: string; color: string }> = {
  contracts: { label: "Contratos", badge: "border-blue-200 bg-blue-50 text-blue-800", dot: "bg-blue-500", color: "#3b82f6" },
  execution: { label: "Execução", badge: "border-amber-200 bg-amber-50 text-amber-800", dot: "bg-amber-500", color: "#f59e0b" },
  billing: { label: "Cobrança", badge: "border-violet-200 bg-violet-50 text-violet-800", dot: "bg-violet-500", color: "#8b5cf6" },
  done: { label: "Concluído", badge: "border-green-200 bg-green-50 text-green-800", dot: "bg-green-500", color: "#22c55e" },
  cancelled: { label: "Cancelado", badge: "border-red-200 bg-red-50 text-red-700", dot: "bg-red-500", color: "#ef4444" },
};

export const stageOf = (contract: any): string | undefined => contract?.status?.status_current;
export const departmentOf = (stage: string | undefined): Department | null => (stage && STAGE_DEPARTMENT[stage]) || null;

// Etapas em que o contrato já foi aprovado pela Execução e pode ser (re)enviado.
export const SENDABLE_STAGES = ["Aguardando Envio", "Em Embarque", "Em Cobrança", "Concluído"];

export type WorkflowAction = "submit" | "approve" | "return" | "ship_done" | "cancel" | "reopen";

export const ACTIONS: Record<WorkflowAction, { label: string; from: string[]; reason?: string; adminOnly?: boolean; tone: "primary" | "outline" | "danger" }> = {
  submit: { label: "Enviar para Execução", from: ["Em Elaboração", "Devolvido"], tone: "primary" },
  approve: { label: "Aprovar", from: ["Em Análise"], tone: "primary" },
  return: { label: "Devolver", from: ["Em Análise", "Aguardando Envio"], reason: "O que precisa ser corrigido em Contratos?", tone: "outline" },
  ship_done: { label: "Embarque concluído", from: ["Em Embarque"], tone: "primary" },
  cancel: { label: "Cancelar contrato", from: ["Em Elaboração", "Devolvido", "Em Análise", "Aguardando Envio", "Em Embarque", "Em Cobrança"], reason: "Por que o contrato está sendo cancelado?", tone: "danger" },
  reopen: { label: "Reabrir", from: ["Cancelado"], reason: "Por que o contrato está sendo reaberto?", adminOnly: true, tone: "outline" },
};

const MODULE_OF: Partial<Record<Department, string>> = { contracts: "contracts", execution: "execution", billing: "billing" };

interface UserLike { role?: string; permissions?: Record<string, string[]> }

const isAdmin = (u?: UserLike | null) => u?.role === "admin" || u?.role === "superadmin";

// Ações que o usuário pode fazer agora (a API confere de novo; aqui é só para mostrar os botões certos).
export function actionsFor(contract: any, user?: UserLike | null): WorkflowAction[] {
  const stage = stageOf(contract);
  const dept = departmentOf(stage);
  if (!stage || !dept) return [];
  const module = MODULE_OF[dept];
  const worksHere = isAdmin(user) || (!!module && !!user?.permissions?.[module]?.includes("edit"));
  return (Object.keys(ACTIONS) as WorkflowAction[]).filter((a) => {
    const rule = ACTIONS[a];
    if (!rule.from.includes(stage)) return false;
    return rule.adminOnly ? isAdmin(user) : worksHere;
  });
}

export const ACTION_PAST: Record<string, string> = {
  create: "Contrato criado",
  submit: "Enviado para a Execução",
  approve: "Aprovado pela Execução",
  return: "Devolvido para Contratos",
  send: "Enviado ao cliente",
  ship_done: "Embarque concluído",
  billing: "Atualizado pela Cobrança",
  cancel: "Cancelado",
  reopen: "Reaberto",
  migration: "Convertido para o fluxo por departamento",
};
