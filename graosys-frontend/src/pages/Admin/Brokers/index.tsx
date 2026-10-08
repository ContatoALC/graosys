import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Handshake, Percent } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { api } from "@/services/api";
import { formatDate } from "@/lib/utils";
import { useForm } from "react-hook-form";

interface BrokerForm { name: string; cnpj_cpf: string; email: string; phone: string; active: boolean; user_id: string; }

const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const pct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}%`);
const today = () => new Date().toISOString().slice(0, 10);

// Tabela de comissão do broker: cada % vale a partir da data de início, sem mudar contratos anteriores.
function RatesDialog({ broker, onClose, onChanged }: { broker: any | null; onClose: () => void; onChanged: () => void }) {
  const [rates, setRates] = useState<any[]>([]);
  const [percent, setPercent] = useState("");
  const [validFrom, setValidFrom] = useState(today());
  const [error, setError] = useState("");

  function load() {
    if (broker) api.get(`/api/brokers/${broker.id}/rates`).then((r) => setRates(r.data)).catch(console.error);
  }
  useEffect(() => { setRates([]); setPercent(""); setValidFrom(today()); setError(""); load(); }, [broker?.id]);

  async function add() {
    setError("");
    try {
      await api.post(`/api/brokers/${broker.id}/rates`, { percent: Number(percent), valid_from: validFrom });
      setPercent(""); load(); onChanged();
    } catch (e: any) { setError(e.response?.data?.error || "Erro ao salvar"); }
  }

  async function remove(id: string) {
    if (!confirm("Excluir esta vigência? Contratos do período passam a usar a vigência anterior.")) return;
    try { await api.delete(`/api/brokers/${broker.id}/rates/${id}`); load(); onChanged(); }
    catch (e: any) { setError(e.response?.data?.error || "Erro ao excluir"); }
  }

  const current = rates.find((r) => r.valid_from <= today());
  return (
    <Dialog open={!!broker} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Tabela de comissão: {broker?.name}</DialogTitle>
          <DialogDescription>% sobre a comissão que a corretora recebe dos contratos do broker. Cada % vale para contratos emitidos a partir da data de início.</DialogDescription>
        </DialogHeader>
        <div className="rounded-md border">
          <Table>
            <TableHeader><TableRow><TableHead>Início</TableHead><TableHead className="text-right">%</TableHead><TableHead>Lançado por</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
            <TableBody>
              {rates.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="h-14 text-center text-sm text-muted-foreground">Nenhum % cadastrado</TableCell></TableRow>
              ) : rates.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{formatDate(r.valid_from)} {r.id === current?.id && <Badge variant="outline" className="ml-1">Atual</Badge>}</TableCell>
                  <TableCell className="text-right font-medium">{pct(r.percent)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.created_by_name ?? "—"}</TableCell>
                  <TableCell><Button variant="ghost" size="icon" onClick={() => remove(r.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
          <div className="space-y-1"><Label>Novo %</Label><Input type="number" step="0.0001" min="0" max="100" placeholder="ex.: 0,50" value={percent} onChange={(e) => setPercent(e.target.value)} /></div>
          <div className="space-y-1"><Label>A partir de</Label><DatePicker aria-label="A partir de" value={validFrom} onChange={setValidFrom} /></div>
          <Button type="button" onClick={add} disabled={percent === "" || !validFrom}>Adicionar</Button>
        </div>
        {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AdminBrokersPage() {
  const [brokers, setBrokers] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [ratesBroker, setRatesBroker] = useState<any | null>(null);
  const { register, handleSubmit, reset } = useForm<BrokerForm>({ defaultValues: { active: true, user_id: "" } });

  function load() { api.get("/api/brokers").then((r) => setBrokers(r.data)).catch(console.error); }
  useEffect(() => { load(); api.get("/api/users").then((r) => setUsers(r.data)).catch(console.error); }, []);

  function openNew() { reset({ name: "", cnpj_cpf: "", email: "", phone: "", active: true, user_id: "" }); setEditingId(null); setShowDialog(true); }
  function openEdit(b: any) { reset({ name: b.name, cnpj_cpf: b.cnpj_cpf ?? "", email: b.email ?? "", phone: b.phone ?? "", active: b.active, user_id: b.user_id ?? "" }); setEditingId(b.id); setShowDialog(true); }

  async function onSubmit(data: BrokerForm) {
    try {
      const payload = { ...data, user_id: data.user_id || null };
      if (editingId) { await api.patch(`/api/brokers/${editingId}`, payload); }
      else { await api.post("/api/brokers", payload); }
      setShowDialog(false); load();
    } catch (e: any) { alert(e.response?.data?.error || "Erro ao salvar"); }
  }

  async function del(id: string) {
    if (!confirm("Remover broker?")) return;
    try { await api.delete(`/api/brokers/${id}`); load(); }
    catch (e: any) { alert(e.response?.data?.error || "Erro ao remover"); }
  }

  const userName = (id: string | null) => users.find((u) => u.id === id)?.name;
  return (
    <div className="flex flex-col">
      <PageHeader title="Corretores/Brokers" description="Cadastro, acesso e tabela de comissão dos brokers" action={<Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Novo Broker</Button>} />
      <div className="flex-1 p-6">
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Usuário (login)</TableHead>
                <TableHead className="text-right">% atual</TableHead>
                <TableHead>CNPJ/CPF</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {brokers.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="h-24 text-center"><Handshake className="mx-auto h-6 w-6 text-muted-foreground" /><p className="text-muted-foreground">Nenhum broker</p></TableCell></TableRow>
              ) : brokers.map((b) => (
                <TableRow key={b.id}>
                  <TableCell><Badge variant={b.active ? "default" : "secondary"}>{b.active ? "Ativo" : "Inativo"}</Badge></TableCell>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell className="text-sm">{userName(b.user_id) ?? <span className="text-muted-foreground">Sem acesso</span>}</TableCell>
                  <TableCell className="text-right font-medium">{pct(b.current_percent)}</TableCell>
                  <TableCell>{b.cnpj_cpf}</TableCell>
                  <TableCell>{b.email}</TableCell>
                  <TableCell>{b.phone}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" title="Tabela de comissão" onClick={() => setRatesBroker(b)}><Percent className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(b)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => del(b.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      </div>
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "Editar Broker" : "Novo Broker"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2"><Label>Nome *</Label><Input {...register("name", { required: true })} /></div>
            <div className="space-y-2">
              <Label>Usuário (login)</Label>
              <select key={users.length} className={selectClass} {...register("user_id")}>
                <option value="">Sem acesso ao sistema</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
              </select>
              <p className="text-xs text-muted-foreground">Com um usuário vinculado, o broker vê as próprias comissões em "Minhas Comissões".</p>
            </div>
            <div className="space-y-2"><Label>CNPJ/CPF</Label><Input {...register("cnpj_cpf")} /></div>
            <div className="space-y-2"><Label>E-mail</Label><Input type="email" {...register("email")} /></div>
            <div className="space-y-2"><Label>Telefone</Label><Input {...register("phone")} /></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register("active")} className="h-4 w-4" />Ativo</label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
              <Button type="submit">{editingId ? "Salvar" : "Criar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <RatesDialog broker={ratesBroker} onClose={() => setRatesBroker(null)} onChanged={load} />
    </div>
  );
}
