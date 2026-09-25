import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Truck, Eye, Search, RefreshCw, Mail, Scale } from "lucide-react";
import { ContractFixationsDialog } from "@/components/ContractFixationsDialog";
import { useAuth } from "@/contexts/AuthContext";
import { ContractEmailDialog } from "./ContractEmailDialog";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/services/api";
import { formatCurrency, formatDate } from "@/lib/utils";

const statusVariant: Record<string, any> = {
  Ativo: "success",
  Cancelado: "destructive",
  "Em Execução": "warning",
  Encerrado: "secondary",
};

const STATUS_OPTIONS = ["Ativo", "Em Execução", "Encerrado", "Cancelado"];

export function ExecutionPage() {
  const [contracts, setContracts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [emailContract, setEmailContract] = useState<any | null>(null);
  const [fixContract, setFixContract] = useState<any | null>(null);
  const [emailSummary, setEmailSummary] = useState<Record<string, { seller?: string; buyer?: string }>>({});
  const { user } = useAuth();
  const canSend = user?.role === "admin" || user?.role === "superadmin" || !!user?.permissions?.execution?.includes("edit");

  function loadSummary() {
    api.get("/api/email/summary").then((r) => setEmailSummary(r.data)).catch(() => setEmailSummary({}));
  }

  function load() {
    setIsLoading(true);
    api.get("/api/contracts", { params: { search: search || undefined, limit: 100 } })
      .then((r) => setContracts(r.data.data))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }

  useEffect(() => { load(); loadSummary(); }, []);

  async function changeStatus(contractId: string, status: string) {
    setUpdatingId(contractId);
    try {
      const res = await api.patch(`/api/contracts/${contractId}/status`, { status });
      setContracts((prev) => prev.map((c) => c.id === contractId ? res.data : c));
    } catch (e) {
      console.error(e);
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="flex flex-col">
      <PageHeader title="Execução" description="Controle de status e execução dos contratos" />

      <div className="flex-1 space-y-4 p-6">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar contrato..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} className="pl-9" />
          </div>
          <Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button>
        </div>

        {/* KPI cards */}
        <div className="grid gap-4 sm:grid-cols-4">
          {STATUS_OPTIONS.map((s) => {
            const count = contracts.filter((c) => c.status?.status_current === s).length;
            return (
              <Card key={s}>
                <CardContent className="pt-4 pb-4">
                  <p className="text-xs font-medium text-muted-foreground">{s}</p>
                  <p className="mt-1 text-2xl font-bold">{count}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº Contrato</TableHead>
                  <TableHead>Produto / Safra</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Retirada</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Status Atual</TableHead>
                  <TableHead>Alterar Status</TableHead>
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
                      <p className="mt-2 text-muted-foreground">Nenhum contrato encontrado</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  contracts.map((c) => (
                    <TableRow key={c.id}>
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
                      <TableCell>
                        <Badge variant={statusVariant[c.status?.status_current] ?? "outline"}>
                          {c.status?.status_current ?? "—"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          disabled={updatingId === c.id}
                          value={c.status?.status_current}
                          onValueChange={(val) => changeStatus(c.id, val)}
                        >
                          <SelectTrigger className="h-8 w-36 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
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
                        <Button variant="ghost" size="icon" asChild>
                          <Link to={`/contracts/${c.id}`}><Eye className="h-4 w-4" /></Link>
                        </Button>
                        {c.price_type === "to_fix" && (
                          <Button variant="ghost" size="icon" title="Fixações de preço" onClick={() => setFixContract(c)}>
                            <Scale className="h-4 w-4" />
                          </Button>
                        )}
                        {canSend && (
                          <Button variant="ghost" size="icon" title="Enviar contrato por e-mail" onClick={() => setEmailContract(c)}>
                            <Mail className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <ContractFixationsDialog contract={fixContract} onClose={() => setFixContract(null)} onChanged={load} />
      <ContractEmailDialog contract={emailContract} canSend={canSend} onClose={() => setEmailContract(null)} onSent={loadSummary} />
    </div>
  );
}

function formatDateTime(v: string) {
  return new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
