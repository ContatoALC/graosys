import { cn } from "@/lib/utils";
import { DEPARTMENTS, departmentOf, stageOf } from "@/lib/workflow";

// Selo do status: a cor e o nome em maiúsculas dizem em que departamento o contrato está.
// Na Cobrança, mostra a situação dos recebimentos (A Faturar, A Receber...).
export function ContractStageBadge({ contract, className }: { contract: any; className?: string }) {
  const stage = stageOf(contract);
  const dept = departmentOf(stage);
  if (!dept) return <span className="text-xs text-muted-foreground">{stage ?? "—"}</span>;
  const meta = DEPARTMENTS[dept];
  const detail = dept === "billing" ? contract.billing_status || stage : dept === "done" || dept === "cancelled" ? null : stage;
  return (
    <span
      data-testid="contract-stage"
      title={`Departamento: ${meta.label}`}
      className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium", meta.badge, className)}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", meta.dot)} />
      <span className="text-[10px] font-semibold uppercase tracking-wide">{meta.label}</span>
      {detail && <span>· {detail}</span>}
    </span>
  );
}
