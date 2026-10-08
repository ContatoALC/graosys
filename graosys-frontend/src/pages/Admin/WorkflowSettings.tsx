import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/services/api";
import { cn } from "@/lib/utils";

const MODES = [
  {
    value: "full",
    label: "Fluxo completo",
    description: "Contratos registra → Execução analisa e aprova → envia ao cliente → Cobrança recebe a comissão. Cada pessoa sabe o seu papel.",
  },
  {
    value: "simple",
    label: "Fluxo simplificado",
    description: "Para corretora com um só operador: o contrato já nasce pronto para envio, sem a etapa de análise. O resto do fluxo continua igual.",
  },
];

// Como o contrato anda entre os departamentos da corretora.
export function WorkflowSettings() {
  const [mode, setMode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    api.get("/api/tenant").then((r) => setMode(r.data?.workflow_mode ?? "full")).catch(() => setMode("full"));
  }, []);

  async function choose(value: string) {
    if (value === mode || saving) return;
    setSaving(true); setMessage(null);
    try {
      const r = await api.patch("/api/tenant", { workflow_mode: value });
      setMode(r.data.workflow_mode);
      setMessage({ type: "ok", text: "Fluxo atualizado. Vale para os contratos criados a partir de agora." });
    } catch (e: any) {
      setMessage({ type: "error", text: e.response?.data?.error || "Erro ao salvar" });
    } finally { setSaving(false); }
  }

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Fluxo dos contratos</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Fluxo dos contratos">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={mode === m.value}
              disabled={mode === null || saving}
              onClick={() => choose(m.value)}
              className={cn("rounded-lg border p-4 text-left transition-colors", mode === m.value ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50")}
            >
              <p className="font-semibold">{m.label}</p>
              <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>
            </button>
          ))}
        </div>
        {message && <p className={message.type === "ok" ? "text-sm text-green-700" : "text-sm text-destructive"}>{message.text}</p>}
      </CardContent>
    </Card>
  );
}
