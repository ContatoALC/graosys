import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Truck, Eye, Search, RefreshCw, Mail, Scale } from "lucide-react";
import { ContractFixationsDialog } from "@/components/ContractFixationsDialog";
import { ContractPdfButton } from "@/components/ContractPdfButton";
import { ContractStageBadge } from "@/components/ContractStageBadge";
import { ContractWorkflowActions, ROW_BUTTON } from "@/components/ContractWorkflowActions";
import { useAuth } from "@/contexts/AuthContext";
import { ContractEmailDialog } from "./ContractEmailDialog";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/services/api";
import { cn, formatDate } from "@/lib/utils";
import { DEPARTMENTS, SENDABLE_STAGES, stageOf } from "@/lib/workflow";

// Etapas da Execução, na ordem da linha de montagem.
const QUEUE_STAGES = ["Em Análise", "Aguardando Envio", "Em Embarque"];

export function ExecutionPage() {
  const [contracts, setContracts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<"queue" | "all">("queue");
  const [emailContract, setEmailContract] = useState<any | null>(null);
  const [fixContract, setFixContract] = useState<any | null>(null);
  const [emailSummary, setEmailSummary] = useState<Record<string, { seller?: string; buyer?: string }>>({});
  const { user } = useAuth();
  const canSend = user?.role === "admin" || user?.role === "superadmin" || !!user?.permissions?.execution?.includes("edit");

  function loadSummary() {
    api.get("/api/email/summary").then((r) => setEmailSummary(r.data)).catch(() => setEmailSummary({}));
  }

  function load(v = view) {
    setIsLoading(true);
    api.get("/api/contracts", { params: { search: search || undefined, limit: 100, department: v === "queue" ? "execution" : undefined } })
      .then((r) => setContracts(r.data.data))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }

  useEffect(() => { load(); loadSummary(); }, []);

  const replace = (updated: any) => setContracts((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
  const changeView = (v: "queue" | "all") => { setView(v); load(v); };

  return (
    <div className="flex flex-col">
      <PageHeader title="Execução" description="Analisa o contrato vindo de Contratos, envia ao cliente e acompanha o embarque" />

      <div className="flex-1 space-y-4 p-6">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar contrato..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} className="pl-9" />
          </div>
          <Button variant="outline" onClick={() => load()}><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button>
          <div className="ml-auto flex rounded-md border p-0.5" role="group" aria-label="Contratos exibidos">
            <Button size="sm" variant={view === "queue" ? "default" : "ghost"} aria-pressed={view === "queue"} onClick={() => changeView("queue")}>Fila da Execução</Button>
            <Button size="sm" variant={view === "all" ? "default" : "ghost"} aria-pressed={view === "all"} onClick={() => changeView("all")}>Todos</Button>
          </div>
        </div>

        {/* Quanto há em cada posto da Execução */}
        {view === "queue" && (
          <div className="grid gap-4 sm:grid-cols-3">
            {QUEUE_STAGES.map((stage) => (
              <Card key={stage} className="border-l-4" style={{ borderLeftColor: DEPARTMENTS.execution.color }}>
                <CardContent className="pt-4 pb-4">
                  <p className="text-xs font-medium text-muted-foreground">{stage}</p>
                  <p className="mt-1 text-2xl font-bold">{contracts.filter((c) => stageOf(c) === stage).length}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Próximo passo</TableHead>
                  <TableHead>Nº Contrato</TableHead>
                  <TableHead>Produto / Safra</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Retirada</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Envio</TableHead>
                  <TableHead className="w-32" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>{[...Array(9)].map((_, j) => <TableCell key={j}><div className="h-4 animate-pulse rounded bg-muted" /></TableCell>)}</TableRow>
                  ))
                ) : contracts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center">
                      <Truck className="mx-auto h-8 w-8 text-muted-foreground" />
                      <p className="mt-2 text-muted-foreground">{view === "queue" ? "Nenhum contrato aguardando a Execução" : "Nenhum contrato encontrado"}</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  contracts.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell><ContractStageBadge contract={c} /></TableCell>
                      <TableCell>
                        <div className="flex flex-nowrap items-center gap-1.5">
                          {stageOf(c) === "Aguardando Envio" && canSend && (
                            <Button type="button" size="sm" className={ROW_BUTTON} onClick={() => setEmailContract(c)}>Enviar ao cliente</Button>
                          )}
                          <ContractWorkflowActions compact contract={c} only={["approve", "return", "ship_done"]} onChanged={replace} />
                        </div>
                      </TableCell>
                      <TableCell className="font-medium"><button type="button" className="text-left underline-offset-2 hover:underline" title="Ver envios" onClick={() => setEmailContract(c)}>{c.number_contract}</button></TableCell>
                      <TableCell>{c.name_product}<br /><span className="text-xs text-muted-foreground">{c.crop}</span></TableCell>
                      <TableCell>
                        {c.quantity} {c.type_quantity}
                        {c.price_type === "to_fix" && (
                          <button type="button" className="text-xs text-muted-foreground underline-offset-2 hover:underline" title="Ver e lançar fixações" onClick={() => setFixContract(c)}>
                            A fixar: {Math.round((Number(c.fixed_quantity) / (Number(c.quantity) || 1)) * 100)}% fixado
                          </button>
                        )}
                      </TableCell>
                      <TableCell>{c.pickup_location}</TableCell>
                      <TableCell className="text-xs">{formatDate(c.initial_pickup_date)} — {formatDate(c.final_pickup_date)}</TableCell>
                      <TableCell className="text-xs">
                        <button type="button" className="space-y-0.5 text-left" title="Ver envios" onClick={() => setEmailContract(c)}>
                          {emailSummary[c.id]?.seller || emailSummary[c.id]?.buyer ? (
                            <>
                              <p>Vend.: {emailSummary[c.id]?.seller ? formatDateTime(emailSummary[c.id].seller!) : "—"}</p>
                              <p>Comp.: {emailSummary[c.id]?.buyer ? formatDateTime(emailSummary[c.id].buyer!) : "—"}</p>
                            </>
                          ) : <span className="text-muted-foreground">Não enviado</span>}
                        </button>
                      </TableCell>
                      <TableCell>
                        {/* Posições fixas: o ícone de fixação reserva o lugar mesmo quando não se aplica. */}
                        <div className="flex flex-nowrap items-center">
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Abrir contrato" asChild>
                            <Link to={`/contracts/${c.id}`}><Eye className="h-4 w-4" /></Link>
                          </Button>
                          {c.price_type === "to_fix" ? (
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Fixações de preço" onClick={() => setFixContract(c)}>
                              <Scale className="h-4 w-4" />
                            </Button>
                          ) : <span className="h-8 w-8" aria-hidden="true" />}
                          <ContractPdfButton contractId={c.id} />
                          {canSend && (
                            <Button
                              variant="ghost" size="icon" className="h-8 w-8"
                              title={SENDABLE_STAGES.includes(stageOf(c) ?? "") ? "Enviar contrato por e-mail" : "Envios do contrato (o envio libera após a aprovação da Execução)"}
                              onClick={() => setEmailContract(c)}
                            >
                              <Mail className={cn("h-4 w-4", !SENDABLE_STAGES.includes(stageOf(c) ?? "") && "opacity-40")} />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <ContractFixationsDialog contract={fixContract} onClose={() => setFixContract(null)} onChanged={() => load()} />
      <ContractEmailDialog contract={emailContract} canSend={canSend && SENDABLE_STAGES.includes(stageOf(emailContract) ?? "")} onClose={() => setEmailContract(null)} onSent={() => { loadSummary(); load(); }}
        onRecipients={(contractId, lists) => setContracts((prev) => prev.map((c) => (c.id === contractId ? { ...c, ...lists } : c)))} />
    </div>
  );
}

function formatDateTime(v: string) {
  return new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
