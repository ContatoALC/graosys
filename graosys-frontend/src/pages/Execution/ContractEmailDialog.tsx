import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { api } from "@/services/api";

interface Log {
  id: string; party: "seller" | "buyer"; party_names: string | null; recipients: string[];
  status: string; error: string | null; copy_correct: boolean;
  sent_by_name: string | null; sent_by_email: string | null; sent_at: string;
}

const fmt = (v: string) => new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

function LogGrid({ title, logs }: { title: string; logs: Log[] }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data/hora</TableHead><TableHead>Enviado por</TableHead><TableHead>Enviado para</TableHead><TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="h-14 text-center text-sm text-muted-foreground">Nenhum envio</TableCell></TableRow>
            ) : logs.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="whitespace-nowrap text-xs">{fmt(l.sent_at)}</TableCell>
                <TableCell className="text-xs"><p className="font-medium">{l.sent_by_name ?? "—"}</p><p className="text-muted-foreground">{l.sent_by_email}</p></TableCell>
                <TableCell className="text-xs">
                  {l.party_names && <p className="font-medium">{l.party_names}</p>}
                  <p className="text-muted-foreground">{l.recipients.join(", ")}</p>
                </TableCell>
                <TableCell className="text-xs">
                  <Badge variant={l.status === "sent" ? "success" : "destructive"}>{l.status === "sent" ? "Enviado" : "Falhou"}</Badge>
                  {l.copy_correct && <p className="mt-1 text-muted-foreground">Cópia correta</p>}
                  {l.error && <p className="mt-1 text-destructive">{l.error}</p>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function ContractEmailDialog({ contract, canSend, onClose, onSent }: { contract: any | null; canSend: boolean; onClose: () => void; onSent: () => void }) {
  const [logs, setLogs] = useState<Log[]>([]);
  const [copyCorrect, setCopyCorrect] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  function loadLogs() {
    if (!contract) return;
    api.get(`/api/contracts/${contract.id}/email-logs`).then((r) => setLogs(r.data)).catch(() => setLogs([]));
  }

  useEffect(() => { setCopyCorrect(false); setResult(null); setLogs([]); loadLogs(); }, [contract?.id]);

  async function send() {
    setSending(true); setResult(null);
    try {
      const r = await api.post("/api/email/send-contract", { contract_id: contract.id, copy_correct: copyCorrect });
      setResult({ type: "ok", text: `${r.data.message} (${r.data.sent_to.length} destinatário(s))` });
    } catch (e: any) {
      setResult({ type: "error", text: e.response?.data?.error || "Erro ao enviar e-mail" });
    } finally { setSending(false); loadLogs(); onSent(); }
  }

  const sellerEmails: string[] = contract?.list_email_seller || [];
  const buyerEmails: string[] = contract?.list_email_buyer || [];
  const noEmails = sellerEmails.length === 0 && buyerEmails.length === 0;

  return (
    <Dialog open={!!contract} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Contrato {contract?.number_contract}: envios</DialogTitle>
          <DialogDescription>Histórico de e-mails enviados ao vendedor e ao comprador.</DialogDescription>
        </DialogHeader>

        <LogGrid title="Vendedor" logs={logs.filter((l) => l.party === "seller")} />
        <LogGrid title="Comprador" logs={logs.filter((l) => l.party === "buyer")} />

        {canSend && (
          <div className="space-y-3 rounded-md border bg-muted/30 p-4">
            <p className="text-sm">
              Enviar o contrato em PDF para o vendedor ({sellerEmails.join(", ") || "sem e-mail"}) e para o comprador ({buyerEmails.join(", ") || "sem e-mail"}).
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={copyCorrect} onChange={(e) => setCopyCorrect(e.target.checked)} className="h-4 w-4" />
              Marcar como "CÓPIA CORRETA" (reenvio)
            </label>
            {result && <p className={result.type === "ok" ? "text-sm text-green-700" : "text-sm text-destructive"}>{result.text}</p>}
            <Button onClick={send} disabled={sending || noEmails}><Mail className="mr-2 h-4 w-4" />{sending ? "Enviando..." : "Enviar agora"}</Button>
            {noEmails && <p className="text-xs text-muted-foreground">Cadastre ao menos um e-mail de vendedor ou comprador no contrato.</p>}
          </div>
        )}
        <DialogFooter><Button variant="outline" onClick={onClose}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
