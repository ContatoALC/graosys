import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Handshake } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { api } from "@/services/api";
import { useForm } from "react-hook-form";

interface BrokerForm { name: string; cnpj_cpf: string; email: string; phone: string; active: boolean; }

export function AdminBrokersPage() {
  const [brokers, setBrokers] = useState<any[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { register, handleSubmit, reset } = useForm<BrokerForm>({ defaultValues: { active: true } });

  function load() { api.get("/api/brokers").then((r) => setBrokers(r.data)).catch(console.error); }
  useEffect(() => { load(); }, []);

  function openNew() { reset({ name: "", cnpj_cpf: "", email: "", phone: "", active: true }); setEditingId(null); setShowDialog(true); }
  function openEdit(b: any) { reset({ name: b.name, cnpj_cpf: b.cnpj_cpf ?? "", email: b.email ?? "", phone: b.phone ?? "", active: b.active }); setEditingId(b.id); setShowDialog(true); }

  async function onSubmit(data: BrokerForm) {
    try {
      if (editingId) { await api.patch(`/api/brokers/${editingId}`, data); }
      else { await api.post("/api/brokers", data); }
      setShowDialog(false); load();
    } catch (e: any) { alert(e.response?.data?.error || "Erro ao salvar"); }
  }

  async function del(id: string) {
    if (!confirm("Remover broker?")) return;
    try { await api.delete(`/api/brokers/${id}`); load(); }
    catch (e: any) { alert(e.response?.data?.error || "Erro ao remover"); }
  }

  return (
    <div className="flex flex-col">
      <PageHeader title="Corretores/Brokers" description="Cadastro de corretores e brokers" action={<Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Novo Broker</Button>} />
      <div className="flex-1 p-6">
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CNPJ/CPF</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {brokers.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-24 text-center"><Handshake className="mx-auto h-6 w-6 text-muted-foreground" /><p className="text-muted-foreground">Nenhum broker</p></TableCell></TableRow>
              ) : brokers.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell>{b.cnpj_cpf}</TableCell>
                  <TableCell>{b.email}</TableCell>
                  <TableCell>{b.phone}</TableCell>
                  <TableCell><Badge variant={b.active ? "default" : "secondary"}>{b.active ? "Ativo" : "Inativo"}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
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
    </div>
  );
}
