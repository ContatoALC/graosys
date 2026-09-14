import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/services/api";
import { useForm, Controller } from "react-hook-form";

interface UserForm { name: string; email: string; password: string; role: string; active: boolean; }

export function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { register, handleSubmit, reset, control } = useForm<UserForm>({ defaultValues: { role: "user", active: true } });

  function load() {
    api.get("/api/users").then((r) => setUsers(r.data)).catch(console.error);
  }
  useEffect(() => { load(); }, []);

  function openNew() { reset({ role: "user", active: true }); setEditingId(null); setShowDialog(true); }
  function openEdit(u: any) { reset({ name: u.name, email: u.email, role: u.role, active: u.active, password: "" }); setEditingId(u.id); setShowDialog(true); }

  async function onSubmit(data: UserForm) {
    try {
      if (editingId) {
        await api.patch(`/api/users/${editingId}`, data);
      } else {
        await api.post("/api/users", data);
      }
      setShowDialog(false);
      load();
    } catch (e: any) {
      alert(e.response?.data?.error || "Erro ao salvar");
    }
  }

  async function deleteUser(id: string) {
    if (!confirm("Remover este usuário?")) return;
    await api.delete(`/api/users/${id}`);
    load();
  }

  return (
    <div className="flex flex-col">
      <PageHeader title="Usuários" description="Gerenciar usuários da corretora" action={<Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Novo Usuário</Button>} />
      <div className="flex-1 p-6">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      <Users className="mx-auto h-6 w-6 text-muted-foreground" />
                      <p className="text-muted-foreground">Nenhum usuário</p>
                    </TableCell>
                  </TableRow>
                ) : users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell><Badge variant="outline">{u.role === "admin" ? "Administrador" : "Usuário"}</Badge></TableCell>
                    <TableCell><Badge variant={u.active ? "success" : "secondary"}>{u.active ? "Ativo" : "Inativo"}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(u)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteUser(u.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "Editar Usuário" : "Novo Usuário"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2"><Label>Nome</Label><Input {...register("name", { required: true })} /></div>
            <div className="space-y-2"><Label>E-mail</Label><Input type="email" {...register("email", { required: true })} /></div>
            {!editingId && <div className="space-y-2"><Label>Senha</Label><Input type="password" {...register("password", { required: !editingId })} /></div>}
            <div className="space-y-2">
              <Label>Perfil</Label>
              <Controller name="role" control={control} render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Usuário</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              )} />
            </div>
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
