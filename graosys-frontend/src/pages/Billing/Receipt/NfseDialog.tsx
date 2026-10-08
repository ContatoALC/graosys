import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Copy, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/services/api";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

// Valor para colar no campo da prefeitura: "1.234,56" (sem "R$").
const plainMoney = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    // Navegador sem permissão de área de transferência: cópia pelo método antigo.
    const el = document.createElement("textarea");
    el.value = text; el.style.position = "fixed"; el.style.opacity = "0";
    document.body.appendChild(el); el.select();
    const ok = document.execCommand("copy");
    el.remove();
    return ok;
  }
}

function CopyRow({ label, value, multiline }: { label: string; value?: string | null; multiline?: boolean }) {
  const [copied, setCopied] = useState(false);
  const empty = !value || !String(value).trim();
  async function copy() {
    if (empty) return;
    if (await copyText(String(value))) {
      setCopied(true); setTimeout(() => setCopied(false), 1500);
      toast.success(`Copiado: ${label}`);
    } else toast.error("Não foi possível copiar");
  }
  return (
    <div className="flex items-start gap-3 border-b py-2 last:border-0" data-testid={`nfse-${label}`}>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("text-sm", multiline ? "whitespace-pre-wrap" : "truncate", empty && "text-muted-foreground")}>{empty ? "—" : value}</p>
      </div>
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" disabled={empty} title={`Copiar ${label}`} aria-label={`Copiar ${label}`} onClick={copy}>
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
}

// Dados da NFS-e da comissão para copiar e colar no site da prefeitura (até haver emissão integrada).
export function NfseDialog({ contractId, canEdit, onClose, onSaved }: { contractId: string | null; canEdit: boolean; onClose: () => void; onSaved: () => void }) {
  const [data, setData] = useState<any | null>(null);
  const [tab, setTab] = useState(0);
  const [billingId, setBillingId] = useState("");
  const [rps, setRps] = useState("");
  const [nfs, setNfs] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setData(null); setTab(0);
    if (!contractId) return;
    api.get(`/api/billings/nfse/${contractId}`).then((r) => {
      setData(r.data);
      const first = r.data.billings.find((b: any) => !b.nfs_number) ?? r.data.billings[0];
      setBillingId(first?.id ?? ""); setRps(first?.rps_number ?? ""); setNfs(first?.nfs_number ?? "");
    }).catch(() => { toast.error("Erro ao carregar os dados da nota"); onClose(); });
  }, [contractId]);

  function pickBilling(id: string) {
    const b = data?.billings.find((x: any) => x.id === id);
    setBillingId(id); setRps(b?.rps_number ?? ""); setNfs(b?.nfs_number ?? "");
  }

  async function saveNumbers() {
    setSaving(true);
    try {
      await api.patch(`/api/billings/${billingId}`, { rps_number: rps.trim() || null, nfs_number: nfs.trim() || null });
      setData((d: any) => ({ ...d, billings: d.billings.map((b: any) => (b.id === billingId ? { ...b, rps_number: rps.trim(), nfs_number: nfs.trim() } : b)) }));
      toast.success("Número da nota registrado no recebimento");
      onSaved();
    } catch (e: any) { toast.error(e.response?.data?.error || "Erro ao registrar o número da nota"); }
    finally { setSaving(false); }
  }

  const note = data?.notes[tab];
  const t = note?.tomador;
  const address = t ? [t.address, t.number, t.complement].filter(Boolean).join(", ") : "";
  const cityUf = t ? [t.city, t.state].filter(Boolean).join("/") : "";

  function copyAll() {
    if (!note) return;
    const lines = [
      `NFS-e — contrato ${data.contract.number_contract} (${note.role.toLowerCase()})`,
      "", "TOMADOR",
      `Nome/Razão social: ${t.name}`, `CNPJ/CPF: ${t.cnpj_cpf || "—"}`, `Inscrição municipal: ${t.ins_mun || "—"}`,
      `Endereço: ${address || "—"}`, `Bairro: ${t.district || "—"}`, `Cidade/UF: ${cityUf || "—"}`, `CEP: ${t.zip_code || "—"}`,
      `E-mail: ${t.email || "—"}`,
      "", "SERVIÇO",
      `Código (LC 116): ${data.service.code} — ${data.service.description}`,
      `Valor: ${note.value_label}`,
      `Discriminação: ${note.description}`,
    ];
    copyText(lines.join("\n")).then((ok) => (ok ? toast.success("Dados da nota copiados") : toast.error("Não foi possível copiar")));
  }

  return (
    <Dialog open={!!contractId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dados para NFS-e{data ? ` · ${data.contract.number_contract}` : ""}</DialogTitle>
          <DialogDescription>Copie cada campo e cole no site da prefeitura. Uma nota por parte que paga comissão.</DialogDescription>
        </DialogHeader>

        {!data ? <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p>
          : data.notes.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Este contrato não tem comissão a faturar.</p>
          : (
            <div className="min-w-0 space-y-4">
              {data.usd_warning && (
                <p className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{data.usd_warning}{data.contract.day_exchange_rate ? ` Câmbio no contrato: ${data.contract.day_exchange_rate}.` : ""}
                </p>
              )}

              {data.notes.length > 1 && (
                <div className="flex rounded-md border p-0.5" role="tablist" aria-label="Notas do contrato">
                  {data.notes.map((n: any, i: number) => (
                    <Button key={n.party} type="button" role="tab" aria-selected={tab === i} size="sm" variant={tab === i ? "default" : "ghost"} className="min-w-0 flex-1 truncate" onClick={() => setTab(i)}>
                      {n.role} · {n.value_label}
                    </Button>
                  ))}
                </div>
              )}

              <section>
                <h3 className="mb-1 text-sm font-semibold">Tomador do serviço ({note.role.toLowerCase()})</h3>
                {t.missing.length > 0 && (
                  <p className="mb-2 flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      Falta no cadastro: {t.missing.join(", ")}.{" "}
                      {t.client_id ? <Link className="underline" to={`/clients/${t.client_id}`}>Completar o cadastro do cliente</Link> : "Cadastre o cliente e vincule-o no contrato."}
                    </span>
                  </p>
                )}
                {note.several_parties && <p className="mb-2 text-xs text-muted-foreground">Contrato com mais de um {note.role.toLowerCase()} ({note.several_parties}): confira quem é o tomador.</p>}
                <CopyRow label="Nome / Razão social" value={t.name} />
                <CopyRow label="CNPJ/CPF" value={t.cnpj_cpf} />
                <CopyRow label="Inscrição municipal" value={t.ins_mun} />
                <CopyRow label="Endereço" value={address} />
                <CopyRow label="Bairro" value={t.district} />
                <CopyRow label="Cidade/UF" value={cityUf} />
                <CopyRow label="CEP" value={t.zip_code} />
                <CopyRow label="E-mail" value={t.email} />
              </section>

              <section>
                <h3 className="mb-1 text-sm font-semibold">Serviço</h3>
                <CopyRow label="Valor do serviço" value={plainMoney(note.value)} />
                <CopyRow label="Discriminação" value={note.description} multiline />
                <CopyRow label="Código do serviço (LC 116)" value={`${data.service.code} — ${data.service.description}`} />
                <p className="mt-2 text-xs text-muted-foreground">
                  O código de serviço e as retenções variam por município: confirme com o contador da corretora.
                  {t.kind === "PJ" && " Tomador pessoa jurídica: verifique a retenção de IRRF (em geral 1,5% sobre comissões e corretagens)."}
                </p>
              </section>

              <section className="space-y-2 rounded-md border bg-muted/30 p-3">
                <h3 className="text-sm font-semibold">Registrar a nota emitida</h3>
                {data.billings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Lance o recebimento deste contrato para registrar o número da nota.</p>
                ) : (
                  <>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <div className="space-y-1 sm:col-span-3">
                        <Label htmlFor="nfse-billing">Recebimento</Label>
                        <select id="nfse-billing" className={selectClass} value={billingId} onChange={(e) => pickBilling(e.target.value)} disabled={!canEdit}>
                          {data.billings.map((b: any) => (
                            <option key={b.id} value={b.id}>
                              {formatCurrency(b.total_service_value)} · {b.status === "received" ? "Recebido" : b.status === "cancelled" ? "Cancelado" : "Pendente"}
                              {b.receipt_date || b.expected_receipt_date ? ` · ${formatDate(b.receipt_date || b.expected_receipt_date)}` : ""}
                              {b.nfs_number ? ` · NFS-e ${b.nfs_number}` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1"><Label htmlFor="nfse-rps">Nº RPS</Label><Input id="nfse-rps" value={rps} onChange={(e) => setRps(e.target.value)} disabled={!canEdit} /></div>
                      <div className="space-y-1"><Label htmlFor="nfse-number">Nº NFS-e</Label><Input id="nfse-number" value={nfs} onChange={(e) => setNfs(e.target.value)} disabled={!canEdit} /></div>
                      <div className="flex items-end"><Button type="button" className="w-full" disabled={!canEdit || saving || !billingId} onClick={saveNumbers}>Registrar</Button></div>
                    </div>
                  </>
                )}
              </section>
            </div>
          )}

        <DialogFooter>
          {note && <Button type="button" variant="outline" onClick={copyAll}><Copy className="mr-2 h-4 w-4" />Copiar tudo</Button>}
          <Button type="button" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
