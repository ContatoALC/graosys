import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, FileText, Eye, Mail } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/services/api";
import { formatCurrency, formatDate } from "@/lib/utils";

const statusVariant: Record<string, any> = {
  Ativo: "success",
  Cancelado: "destructive",
  Encerrado: "secondary",
  "Em Execução": "warning",
};

export function ContractsPage() {
  const [contracts, setContracts] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [toSend, setToSend] = useState<any | null>(null);
  const [copyCorrect, setCopyCorrect] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  function openSend(c: any) { setToSend(c); setCopyCorrect(false); setSendResult(null); }

  async function sendContract() {
    if (!toSend) return;
    setSending(true); setSendResult(null);
    try {
      const r = await api.post("/api/email/send-contract", { contract_id: toSend.id, copy_correct: copyCorrect });
      setSendResult({ type: "ok", text: `${r.data.message} (${r.data.sent_to.length} destinatário(s))` });
    } catch (e: any) {
      setSendResult({ type: "error", text: e.response?.data?.error || "Erro ao enviar e-mail" });
    } finally { setSending(false); }
  }

  function load(q = "") {
    setIsLoading(true);
    api.get("/api/contracts", { params: { search: q || undefined, limit: 50 } })
      .then((r) => { setContracts(r.data.data); setTotal(r.data.total); })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Contratos"
        description={`${total} contratos cadastrados`}
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
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº Contrato</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Safra</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Comprador</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      {[...Array(9)].map((_, j) => (
                        <TableCell key={j}><div className="h-4 animate-pulse rounded bg-muted" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : contracts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <FileText className="h-8 w-8 text-muted-foreground" />
                        <p className="text-muted-foreground">Nenhum contrato encontrado</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  contracts.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.number_contract}</TableCell>
                      <TableCell>{c.name_product}</TableCell>
                      <TableCell>{c.crop}</TableCell>
                      <TableCell className="text-xs">{Array.isArray(c.seller) ? c.seller.join(", ") : c.seller}</TableCell>
                      <TableCell className="text-xs">{Array.isArray(c.buyer) ? c.buyer.join(", ") : c.buyer}</TableCell>
                      <TableCell className="text-right">{formatCurrency(c.total_contract_value)}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[c.status?.status_current] ?? "outline"}>
                          {c.status?.status_current ?? "—"}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(c.contract_emission_date)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" asChild>
                            <Link to={`/contracts/${c.id}`}><Eye className="h-4 w-4" /></Link>
                          </Button>
                          <Button variant="ghost" size="icon" title="Enviar por e-mail (PDF)" onClick={() => openSend(c)}>
                            <Mail className="h-4 w-4" />
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

      <Dialog open={!!toSend} onOpenChange={(open) => !open && setToSend(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar contrato {toSend?.number_contract} por e-mail</DialogTitle>
            <DialogDescription>
              O contrato {toSend?.number_contract} será enviado em PDF ao vendedor ({(toSend?.list_email_seller || []).join(", ") || "sem e-mail"}) e ao comprador ({(toSend?.list_email_buyer || []).join(", ") || "sem e-mail"}).
            </DialogDescription>
          </DialogHeader>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={copyCorrect} onChange={(e) => setCopyCorrect(e.target.checked)} className="h-4 w-4" />
            Marcar como "CÓPIA CORRETA" (reenvio)
          </label>
          {sendResult && <p className={sendResult.type === "ok" ? "text-sm text-green-700" : "text-sm text-destructive"}>{sendResult.text}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setToSend(null)}>Fechar</Button>
            <Button onClick={sendContract} disabled={sending || sendResult?.type === "ok"}>{sending ? "Enviando..." : "Enviar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
