import { cn } from "@/lib/utils";
import { ACTION_PAST, DEPARTMENTS, departmentOf } from "@/lib/workflow";

interface Entry { date: string; time: string; status: string; owner_change: string; action?: string; reason?: string }

// Por onde o contrato passou, quem passou adiante e por quê (o mais recente primeiro).
export function ContractTimeline({ history }: { history?: Entry[] }) {
  const entries = [...(history || [])].reverse();
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">Sem histórico.</p>;
  return (
    <ol className="space-y-4" data-testid="contract-timeline">
      {entries.map((e, i) => {
        const dept = departmentOf(e.status);
        const meta = dept ? DEPARTMENTS[dept] : null;
        return (
          <li key={i} className="flex gap-3">
            <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", meta?.dot ?? "bg-muted-foreground")} />
            <div className="space-y-0.5 text-sm">
              <p>
                <span className="font-medium">{(e.action && ACTION_PAST[e.action]) || "Status alterado"}</span>
                <span className="text-muted-foreground"> → {meta && dept !== "done" && dept !== "cancelled" ? `${meta.label} · ` : ""}{e.status}</span>
              </p>
              <p className="text-xs text-muted-foreground">{e.owner_change} · {e.date} {e.time}</p>
              {e.reason && <p className="rounded bg-muted/50 px-2 py-1 text-xs">{e.reason}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
