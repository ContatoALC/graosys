import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { api } from "@/services/api";

interface Log {
  id: string; party: "seller" | "buyer"; party_names: string | null; recipients: string[];
  status: string; error: string | null; copy_correct: boolean;
  sent_by_name: string | null; sent_by_email: string | null; sent_at: string;
}

const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;
// Aceita vários e-mails separados por vírgula, ponto e vírgula, espaço ou quebra de linha.
const parseEmails = (text: string) => [...new Set(text.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))];
const namesOf = (v: unknown) => (Array.isArray(v) ? v.filter(Boolean).join(", ") : "");
const textareaClass = "flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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

interface Props {
  contract: any | null; canSend: boolean; onClose: () => void; onSent: () => void;
  /** Avisa a tela de origem quando os destinatários do contrato mudam. */
  onRecipients?: (contractId: string, lists: { list_email_seller: string[]; list_email_buyer: string[] }) => void;
}

export function ContractEmailDialog({ contract, canSend, onClose, onSent, onRecipients }: Props) {
  const [sellerText, setSellerText] = useState("");
  const [buyerText, setBuyerText] = useState("");
  const [suggested, setSuggested] = useState<{ seller?: boolean; buyer?: boolean }>({});
  const [logs, setLogs] = useState<Log[]>([]);
  const [copyCorrect, setCopyCorrect] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  function loadLogs() {
    if (!contract) return;
    api.get(`/api/contracts/${contract.id}/email-logs`).then((r) => setLogs(r.data)).catch(() => setLogs([]));
  }

  useEffect(() => {
    setCopyCorrect(false); setResult(null); setLogs([]); loadLogs();
    setSellerText((contract?.list_email_seller || []).join("\n"));
    setBuyerText((contract?.list_email_buyer || []).join("\n"));
    setSuggested({});
    if (!contract) return;
    // Parte sem e-mail no contrato, mas vinculada ao cadastro: sugere os e-mails do cliente.
    let cancelled = false;
    for (const side of ["seller", "buyer"] as const) {
      const ids: string[] = (contract[`${side}_ids`] || []).filter(Boolean);
      if ((contract[`list_email_${side}`] || []).length > 0 || ids.length === 0) continue;
      Promise.all(ids.map((clientId) => api.get(`/api/clients/${clientId}`).then((r) => r.data).catch(() => null))).then((clients) => {
        const emails = [...new Set(clients.flatMap((c) => (c?.contacts || []).map((ct: any) => String(ct.email || "").toLowerCase())).filter(Boolean))];
        if (cancelled || emails.length === 0) return;
        (side === "seller" ? setSellerText : setBuyerText)((prev) => prev || emails.join("\n"));
        setSuggested((prev) => ({ ...prev, [side]: true }));
      });
    }
    return () => { cancelled = true; };
  }, [contract?.id]);

  const sellerEmails = parseEmails(sellerText);
  const buyerEmails = parseEmails(buyerText);
  const invalid = [...sellerEmails, ...buyerEmails].find((e) => !EMAIL_RE.test(e));
  const noEmails = sellerEmails.length === 0 && buyerEmails.length === 0;

  async function send() {
    if (invalid) { setResult({ type: "error", text: `E-mail inválido: ${invalid}` }); return; }
    setSending(true); setResult(null);
    try {
      // Os grupos digitados ficam gravados no contrato; o envio usa o que está gravado.
      const saved = await api.put(`/api/contracts/${contract.id}/email-recipients`, { seller: sellerEmails, buyer: buyerEmails });
      onRecipients?.(contract.id, saved.data);
      const r = await api.post("/api/email/send-contract", { contract_id: contract.id, copy_correct: copyCorrect });
      setResult({ type: "ok", text: `${r.data.message} (${r.data.sent_to.length} destinatário(s))` });
    } catch (e: any) {
      setResult({ type: "error", text: e.response?.data?.error || "Erro ao enviar e-mail" });
    } finally { setSending(false); loadLogs(); onSent(); }
  }

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
            <p className="text-sm">Enviar o contrato em PDF. Cada parte recebe a sua via; a parte sem e-mail não recebe.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="email-seller">E-mails do vendedor</Label>
                <p className="truncate text-xs text-muted-foreground">{namesOf(contract?.seller) || "—"}</p>
                <textarea id="email-seller" className={textareaClass} placeholder="um@exemplo.com, outro@exemplo.com" value={sellerText} onChange={(e) => setSellerText(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="email-buyer">E-mails do comprador</Label>
                <p className="truncate text-xs text-muted-foreground">{namesOf(contract?.buyer) || "—"}</p>
                <textarea id="email-buyer" className={textareaClass} placeholder="um@exemplo.com, outro@exemplo.com" value={buyerText} onChange={(e) => setBuyerText(e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Vários e-mails: separe por vírgula ou um por linha. A lista fica gravada no contrato para os próximos envios.</p>
            {(suggested.seller || suggested.buyer) && <p className="text-xs text-muted-foreground">Os e-mails do {[suggested.seller && "vendedor", suggested.buyer && "comprador"].filter(Boolean).join(" e do ")} vieram do cadastro de clientes.</p>}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={copyCorrect} onChange={(e) => setCopyCorrect(e.target.checked)} className="h-4 w-4" />
              Marcar como "CÓPIA CORRETA" (reenvio)
            </label>
            {result && <p className={result.type === "ok" ? "text-sm text-green-700" : "text-sm text-destructive"}>{result.text}</p>}
            <Button onClick={send} disabled={sending || noEmails}><Mail className="mr-2 h-4 w-4" />{sending ? "Enviando..." : "Enviar agora"}</Button>
            {noEmails && <p className="text-xs text-muted-foreground">Informe ao menos um e-mail de vendedor ou comprador.</p>}
          </div>
        )}
        <DialogFooter><Button variant="outline" onClick={onClose}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
