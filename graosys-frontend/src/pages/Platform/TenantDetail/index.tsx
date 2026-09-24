import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, KeyRound, Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { api } from "@/services/api";
import { PLANS, STATUSES, selectClass, fmtDateTime, PlatformTabs } from "../shared";

interface TenantForm { name: string; cnpj: string; email: string; phone: string; plan: string; status: string; plan_expires_at: string; }
interface UserForm { name: string; email: string; password: string; role: string; }

export function PlatformTenantDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [showUser, setShowUser] = useState(false);
  const [userError, setUserError] = useState("");
  const [resetUser, setResetUser] = useState<any | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const tenantForm = useForm<TenantForm>();
  const userForm = useForm<UserForm>({ defaultValues: { role: "admin" } });

  function load() {
    api.get(`/api/platform/tenants/${id}`).then((r) => {
      setData(r.data);
      const t = r.data.tenant;
      tenantForm.reset({ name: t.name, cnpj: t.cnpj ?? "", email: t.email ?? "", phone: t.phone ?? "", plan: t.plan, status: t.status, plan_expires_at: t.plan_expires_at ? t.plan_expires_at.slice(0, 10) : "" });
    }).catch(console.error);
  }
  useEffect(() => { load(); }, [id]);

  async function saveTenant(f: TenantForm) {
    setMsg(null);
    try {
      await api.patch(`/api/platform/tenants/${id}`, { ...f, plan_expires_at: f.plan_expires_at || null });
      setMsg({ type: "ok", text: "Corretora atualizada" }); load();
    } catch (e: any) { setMsg({ type: "error", text: e.response?.data?.error || "Erro ao salvar" }); }
  }

  async function createUser(f: UserForm) {
    setUserError("");
    try {
      await api.post(`/api/platform/tenants/${id}/users`, f);
      setShowUser(false); load();
    } catch (e: any) { setUserError(e.response?.data?.error || "Erro ao criar usuário"); }
  }

  async function toggleActive(u: any) {
    try { await api.patch(`/api/platform/users/${u.id}`, { active: !u.active }); load(); }
    catch (e: any) { alert(e.response?.data?.error || "Erro ao atualizar usuário"); }
  }

  async function doReset() {
    setResetError("");
    try {
      await api.post(`/api/platform/users/${resetUser.id}/reset-password`, { new_password: newPassword });
      setResetUser(null); setNewPassword(""); setMsg({ type: "ok", text: "Senha redefinida" });
    } catch (e: any) { setResetError(e.response?.data?.error || "Erro ao redefinir senha"); }
  }

  if (!data) return <div className="p-6 text-muted-foreground">Carregando...</div>;
  const { tenant, users, metrics } = data;

  return (
    <div className="flex flex-col">
      <PageHeader
        title={tenant.name}
        description={`${tenant.slug} · criada em ${new Date(tenant.created_at).toLocaleDateString("pt-BR")}`}
        action={<Button variant="outline" asChild><Link to="/platform"><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Link></Button>}
      />
      <PlatformTabs />
      <div className="flex-1 space-y-6 p-6">
        <div className="grid gap-3 sm:grid-cols-4">
          {[["Usuários", metrics.users], ["Clientes", metrics.clients], ["Contratos", metrics.contracts], ["Recebimentos", metrics.billings]].map(([l, v]) => (
            <Card key={l as string}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{l}</p><p className="text-2xl font-semibold">{v}</p></CardContent></Card>
          ))}
        </div>

        <Card><CardContent className="pt-6">
          <form onSubmit={tenantForm.handleSubmit(saveTenant)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Nome *</Label><Input {...tenantForm.register("name", { required: true })} /></div>
              <div className="space-y-2"><Label>CNPJ</Label><Input {...tenantForm.register("cnpj")} /></div>
              <div className="space-y-2"><Label>E-mail</Label><Input type="email" {...tenantForm.register("email")} /></div>
              <div className="space-y-2"><Label>Telefone</Label><Input {...tenantForm.register("phone")} /></div>
              <div className="space-y-2"><Label>Plano</Label><select className={selectClass} {...tenantForm.register("plan")}>{PLANS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></div>
              <div className="space-y-2"><Label>Status</Label><select className={selectClass} {...tenantForm.register("status")}>{STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
              <div className="space-y-2"><Label>Vencimento do plano</Label><Input type="date" {...tenantForm.register("plan_expires_at")} /></div>
            </div>
            {msg && <p className={msg.type === "ok" ? "text-sm text-green-700" : "text-sm text-destructive"}>{msg.text}</p>}
            <Button type="submit" disabled={tenantForm.formState.isSubmitting}>Salvar alterações</Button>
          </form>
        </CardContent></Card>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Usuários</h2>
            <Button size="sm" onClick={() => { userForm.reset({ name: "", email: "", password: "", role: "admin" }); setUserError(""); setShowUser(true); }}><Plus className="mr-2 h-4 w-4" />Novo usuário</Button>
          </div>
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>E-mail</TableHead><TableHead>Perfil</TableHead><TableHead>Status</TableHead><TableHead>Último acesso</TableHead><TableHead className="w-44" /></TableRow></TableHeader>
              <TableBody>
                {users.map((u: any) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell><Badge variant="outline">{u.role === "admin" ? "Administrador" : u.role === "superadmin" ? "Superadmin" : "Usuário"}</Badge></TableCell>
                    <TableCell><Badge variant={u.active ? "success" : "secondary"}>{u.active ? "Ativo" : "Inativo"}</Badge></TableCell>
                    <TableCell className="text-xs">{fmtDateTime(u.last_login_at)}</TableCell>
                    <TableCell>
                      {u.role !== "superadmin" && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => toggleActive(u)}>{u.active ? "Desativar" : "Ativar"}</Button>
                          <Button variant="ghost" size="icon" title="Redefinir senha" onClick={() => { setResetUser(u); setNewPassword(""); setResetError(""); }}><KeyRound className="h-4 w-4" /></Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </div>
      </div>

      <Dialog open={showUser} onOpenChange={setShowUser}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo usuário</DialogTitle></DialogHeader>
          <form onSubmit={userForm.handleSubmit(createUser)} className="space-y-4">
            <div className="space-y-2"><Label>Nome *</Label><Input {...userForm.register("name", { required: true })} /></div>
            <div className="space-y-2"><Label>E-mail *</Label><Input type="email" {...userForm.register("email", { required: true })} /></div>
            <div className="space-y-2"><Label>Senha * (mín. 8 caracteres)</Label><Input type="password" autoComplete="new-password" {...userForm.register("password", { required: true, minLength: 8 })} /></div>
            <div className="space-y-2"><Label>Perfil</Label><select className={selectClass} {...userForm.register("role")}><option value="admin">Administrador</option><option value="user">Usuário</option></select></div>
            {userError && <p className="text-sm text-destructive">{userError}</p>}
            <DialogFooter><Button type="button" variant="outline" onClick={() => setShowUser(false)}>Cancelar</Button><Button type="submit">Criar</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetUser} onOpenChange={(o) => !o && setResetUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Redefinir senha de {resetUser?.name}</DialogTitle></DialogHeader>
          <div className="space-y-2"><Label>Nova senha (mín. 8 caracteres)</Label><Input type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></div>
          {resetError && <p className="text-sm text-destructive">{resetError}</p>}
          <DialogFooter><Button variant="outline" onClick={() => setResetUser(null)}>Cancelar</Button><Button onClick={doReset} disabled={newPassword.length < 8}>Redefinir</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
