import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { ACTIONS, ACTION_PAST, actionsFor, type WorkflowAction } from "@/lib/workflow";
import { api } from "@/services/api";
import { toast } from "sonner";

const VARIANT = { primary: "default", outline: "outline", danger: "destructive" } as const;
export const ROW_BUTTON = "h-8 whitespace-nowrap px-2.5 text-xs";

// Botões do próximo passo do contrato. Só aparecem as ações da etapa atual que o usuário pode fazer.
// "only" limita as ações exibidas (na linha da lista ficam só as de avançar e devolver);
// "compact" usa botões baixos, para caber na linha da tabela.
export function ContractWorkflowActions({ contract, onChanged, only, compact }: {
  contract: any;
  onChanged: (updated: any) => void;
  only?: WorkflowAction[];
  compact?: boolean;
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState<WorkflowAction | null>(null);
  const [asking, setAsking] = useState<WorkflowAction | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const actions = actionsFor(contract, user).filter((a) => !only || only.includes(a));
  if (actions.length === 0) return null;

  async function run(action: WorkflowAction, why?: string) {
    setBusy(action); setError("");
    try {
      const r = await api.post(`/api/contracts/${contract.id}/workflow`, { action, reason: why });
      setAsking(null);
      toast.success(`${ACTION_PAST[action]} · ${contract.number_contract}`);
      onChanged(r.data);
    } catch (e: any) {
      const msg = e.response?.data?.error || "Não foi possível mover o contrato";
      if (asking) setError(msg); else toast.error(msg);
    } finally { setBusy(null); }
  }

  function start(action: WorkflowAction) {
    if (ACTIONS[action].reason) { setReason(""); setError(""); setAsking(action); } else run(action);
  }

  return (
    <>
      <div className={compact ? "flex flex-nowrap gap-1.5" : "flex flex-wrap gap-2"}>
        {actions.map((a) => (
          <Button key={a} type="button" size="sm" className={compact ? ROW_BUTTON : undefined} variant={VARIANT[ACTIONS[a].tone]} disabled={busy !== null} onClick={() => start(a)}>
            {busy === a && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            {ACTIONS[a].label}
          </Button>
        ))}
      </div>

      <Dialog open={asking !== null} onOpenChange={(o) => !o && setAsking(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{asking && ACTIONS[asking].label} · {contract.number_contract}</DialogTitle>
            <DialogDescription>O motivo fica registrado no histórico do contrato.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="workflow-reason">{asking && ACTIONS[asking].reason}</Label>
            <textarea
              id="workflow-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAsking(null)}>Voltar</Button>
            <Button
              variant={asking ? VARIANT[ACTIONS[asking].tone] : "default"}
              disabled={!reason.trim() || busy !== null}
              onClick={() => asking && run(asking, reason.trim())}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
