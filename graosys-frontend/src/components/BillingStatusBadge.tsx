import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Status de cobrança calculado pelo backend a partir dos Recebimentos do contrato.
const STYLES: Record<string, { className?: string; variant?: "outline" | "success" | "destructive"; hint: string }> = {
  "A Faturar": { variant: "outline", hint: "Nenhum recebimento lançado para este contrato" },
  "A Receber": { className: "border-transparent bg-amber-100 text-amber-800", hint: "Recebimento lançado, ainda não recebido" },
  Parcial: { className: "border-transparent bg-blue-100 text-blue-800", hint: "Parte da comissão já foi recebida" },
  Recebido: { variant: "success", hint: "Comissão recebida integralmente" },
  "Em Atraso": { variant: "destructive", hint: "Há recebimento pendente com data prevista vencida" },
};

export function BillingStatusBadge({ status }: { status?: string | null }) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  const style = STYLES[status] ?? { variant: "outline" as const, hint: "" };
  return (
    <Badge variant={style.variant} className={cn("whitespace-nowrap", style.className)} title={style.hint}>
      {status}
    </Badge>
  );
}
