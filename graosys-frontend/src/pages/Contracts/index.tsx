import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Search, FileText, Eye, Copy, Scale } from "lucide-react";
import { ContractFixationsDialog } from "@/components/ContractFixationsDialog";
import { ContractPdfButton } from "@/components/ContractPdfButton";
import { ContractStageBadge } from "@/components/ContractStageBadge";
import { ContractWorkflowActions } from "@/components/ContractWorkflowActions";
import { BillingStatusBadge } from "@/components/BillingStatusBadge";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { stageOf } from "@/lib/workflow";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/services/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useConfirm } from "@/contexts/ConfirmContext";
import { toast } from "sonner";

export function ContractsPage() {
  const confirm = useConfirm();
  const [contracts, setContracts] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [fixContract, setFixContract] = useState<any | null>(null);
  const [view, setView] = useState<"queue" | "all">("queue");

  async function cloneContract(c: any) {
    if (!(await confirm({
      title: `Clonar o contrato ${c.number_contract}?`,
      description: "O clone recebe o próximo número da sua base e começa em Contratos · Em Elaboração.",
      confirmText: "Clonar",
    }))) return;
    setCloningId(c.id);
    try {
      const r = await api.post(`/api/contracts/${c.id}/clone`);
      toast.success(`Contrato clonado: ${r.data.number_contract}`);
      navigate(`/contracts/${r.data.id}`);
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Erro ao clonar contrato");
      setCloningId(null);
    }
  }

  function load(q = search, v = view) {
    setIsLoading(true);
    api.get("/api/contracts", { params: { search: q || undefined, limit: 50, department: v === "queue" ? "contracts" : undefined } })
      .then((r) => { setContracts(r.data.data); setTotal(r.data.total); })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }

  useEffect(() => { load(); }, []);

  const replace = (updated: any) => setContracts((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
  const changeView = (v: "queue" | "all") => { setView(v); load(search, v); };
  const lastReason = (c: any) => c.status?.history?.at(-1)?.reason;

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Contratos"
        description={view === "queue" ? `${total} contrato(s) com Contratos: em elaboração ou devolvidos pela Execução` : `${total} contratos cadastrados`}
        action={
          <Button asChild>
            <Link to="/contracts/new"><Plus className="mr-2 h-4 w-4" />Novo Contrato</Link>
          </Button>
        }
      />

      <div className="flex-1 space-y-4 p-6">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nº contrato..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load(search)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" onClick={() => load(search)}>Buscar</Button>
          {search && <Button variant="ghost" onClick={() => { setSearch(""); load(""); }}>Limpar</Button>}
          <div className="ml-auto flex rounded-md border p-0.5" role="group" aria-label="Contratos exibidos">
            <Button size="sm" variant={view === "queue" ? "default" : "ghost"} aria-pressed={view === "queue"} onClick={() => changeView("queue")}>Fila de Contratos</Button>
            <Button size="sm" variant={view === "all" ? "default" : "ghost"} aria-pressed={view === "all"} onClick={() => changeView("all")}>Todos</Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Cobrança</TableHead>
                  <TableHead>Nº Contrato</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Safra</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Comprador</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      {[...Array(10)].map((_, j) => (
                        <TableCell key={j}><div className="h-4 animate-pulse rounded bg-muted" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : contracts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <FileText className="h-8 w-8 text-muted-foreground" />
                        <p className="text-muted-foreground">{view === "queue" ? "Nenhum contrato aguardando Contratos" : "Nenhum contrato encontrado"}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  contracts.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <ContractStageBadge contract={c} />
                        {stageOf(c) === "Devolvido" && lastReason(c) && (
                          <p className="mt-1 max-w-[14rem] text-xs text-muted-foreground" title={lastReason(c)}>Motivo: {lastReason(c)}</p>
                        )}
                      </TableCell>
                      <TableCell><BillingStatusBadge status={c.billing_status} /></TableCell>
                      <TableCell className="font-medium">
                        {c.number_contract}
                        {c.price_type === "to_fix" && (
                          <button type="button" className="ml-2" title="Ver e lançar fixações" onClick={() => setFixContract(c)}>
                            <Badge variant="outline">A fixar · {Math.round((Number(c.fixed_quantity) / (Number(c.quantity) || 1)) * 100)}%</Badge>
                          </button>
                        )}
                      </TableCell>
                      <TableCell>{c.name_product}</TableCell>
                      <TableCell>{c.crop}</TableCell>
                      <TableCell className="text-xs">{Array.isArray(c.seller) ? c.seller.join(", ") : c.seller}</TableCell>
                      <TableCell className="text-xs">{Array.isArray(c.buyer) ? c.buyer.join(", ") : c.buyer}</TableCell>
                      <TableCell className="text-right">{formatCurrency(c.total_contract_value)}</TableCell>
                      <TableCell>{formatDate(c.contract_emission_date)}</TableCell>
                      <TableCell>
                        <div className="flex flex-nowrap items-center">
                          <span className="mr-1.5"><ContractWorkflowActions compact contract={c} only={["submit"]} onChanged={replace} /></span>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Abrir contrato" asChild>
                            <Link to={`/contracts/${c.id}`}><Eye className="h-4 w-4" /></Link>
                          </Button>
                          {c.price_type === "to_fix" ? (
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Fixações de preço" onClick={() => setFixContract(c)}>
                              <Scale className="h-4 w-4" />
                            </Button>
                          ) : <span className="h-8 w-8" aria-hidden="true" />}
                          <ContractPdfButton contractId={c.id} />
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Clonar contrato" disabled={cloningId === c.id} onClick={() => cloneContract(c)}>
                            <Copy className="h-4 w-4" />
                          </Button>
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

      <ContractFixationsDialog contract={fixContract} onClose={() => setFixContract(null)} onChanged={() => load(search)} />
    </div>
  );
}
