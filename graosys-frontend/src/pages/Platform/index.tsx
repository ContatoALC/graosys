import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Eye, Building2 } from "lucide-react";
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
import { PLANS, STATUSES, statusVariant, selectClass, label, fmtDate, fmtDateTime, isExpired, PlatformTabs, brl } from "./shared";

interface NewTenantForm {
  name: string; slug: string; cnpj: string; email: string; phone: string; plan: string; plan_expires_at: string;
  admin_name: string; admin_email: string; admin_password: string;
}

const summaryCards = [
  { key: "tenants", label: "Corretoras" },
  { key: "active", label: "Ativas" },
  { key: "suspended", label: "Suspensas" },
  { key: "trial", label: "Em trial" },
  { key: "expired", label: "Vencidas" },
  { key: "users", label: "Usuários" },
  { key: "contracts", label: "Contratos" },
  { key: "mrr", label: "MRR (tabela)" },
];

export function PlatformPage() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [error, setError] = useState("");
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<NewTenantForm>({ defaultValues: { plan: "trial" } });

  function load(q = search) {
    setLoading(true);
    Promise.all([
      api.get("/api/platform/tenants", { params: { search: q || undefined } }),
      api.get("/api/platform/summary"),
    ]).then(([t, s]) => { setTenants(t.data); setSummary(s.data); }).catch(console.error).finally(() => setLoading(false));
  }
  useEffect(() => { load(""); }, []);

  function openNew() { reset({ plan: "trial", name: "", slug: "", cnpj: "", email: "", phone: "", plan_expires_at: "", admin_name: "", admin_email: "", admin_password: "" }); setError(""); setShowDialog(true); }

  async function onSubmit(data: NewTenantForm) {
    setError("");
    try {
      await api.post("/api/platform/tenants", { ...data, plan_expires_at: data.plan_expires_at || null });
      setShowDialog(false); load();
    } catch (e: any) { setError(e.response?.data?.error || "Erro ao criar corretora"); }
  }

  return (
    <div className="flex flex-col">
      <PageHeader title="Painel de Controle" description="Gerencie as corretoras que usam o GraoSys" action={<Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Nova Corretora</Button>} />
      <PlatformTabs />
      <div className="flex-1 space-y-4 p-6">
        <div className="grid gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {summaryCards.map((c) => (
            <Card key={c.key}><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="text-2xl font-semibold">{summary[c.key] === undefined ? "—" : c.key === "mrr" ? brl(summary[c.key]) : summary[c.key]}</p>
            </CardContent></Card>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar por nome, identificador ou e-mail..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load(search)} />
          </div>
          <Button variant="outline" onClick={() => load(search)}>Buscar</Button>
          {search && <Button variant="ghost" onClick={() => { setSearch(""); load(""); }}>Limpar</Button>}
        </div>

        <Card><CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Corretora</TableHead><TableHead>Plano</TableHead><TableHead>Status</TableHead><TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Usuários</TableHead><TableHead className="text-right">Clientes</TableHead><TableHead className="text-right">Contratos</TableHead>
                <TableHead>Último acesso</TableHead><TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="h-24 text-center text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : tenants.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="h-24 text-center"><Building2 className="mx-auto h-6 w-6 text-muted-foreground" /><p className="text-muted-foreground">Nenhuma corretora</p></TableCell></TableRow>
              ) : tenants.map((t) => (
                <TableRow key={t.id}>
                  <TableCell><p className="font-medium">{t.name}</p><p className="text-xs text-muted-foreground">{t.slug}</p></TableCell>
                  <TableCell><Badge variant="outline">{label(PLANS, t.plan)}</Badge></TableCell>
                  <TableCell><Badge variant={statusVariant[t.status] ?? "outline"}>{label(STATUSES, t.status)}</Badge></TableCell>
                  <TableCell className={isExpired(t.plan_expires_at) ? "font-medium text-destructive" : ""}>{fmtDate(t.plan_expires_at)}</TableCell>
                  <TableCell className={`text-right ${t.max_users && t.users_count > t.max_users ? "font-medium text-destructive" : ""}`}>{t.users_count}{t.max_users ? ` / ${t.max_users}` : ""}</TableCell>
                  <TableCell className="text-right">{t.clients_count}</TableCell>
                  <TableCell className="text-right">{t.contracts_count}</TableCell>
                  <TableCell className="text-xs">{fmtDateTime(t.last_access)}</TableCell>
                  <TableCell><Button variant="ghost" size="icon" asChild><Link to={`/platform/tenants/${t.id}`}><Eye className="h-4 w-4" /></Link></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova corretora</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Nome *</Label><Input {...register("name", { required: true })} /></div>
              <div className="space-y-2"><Label>Identificador *</Label><Input placeholder="minha-corretora" {...register("slug", { required: true })} /></div>
              <div className="space-y-2"><Label>CNPJ</Label><Input {...register("cnpj")} /></div>
              <div className="space-y-2"><Label>Telefone</Label><Input {...register("phone")} /></div>
              <div className="space-y-2 sm:col-span-2"><Label>E-mail da corretora</Label><Input type="email" {...register("email")} /></div>
              <div className="space-y-2"><Label>Plano</Label><select className={selectClass} {...register("plan")}>{PLANS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></div>
              <div className="space-y-2"><Label>Vencimento</Label><Input type="date" {...register("plan_expires_at")} /></div>
            </div>
            <div className="space-y-3 border-t pt-4">
              <p className="text-sm font-medium">Primeiro administrador</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label>Nome *</Label><Input {...register("admin_name", { required: true })} /></div>
                <div className="space-y-2"><Label>E-mail *</Label><Input type="email" {...register("admin_email", { required: true })} /></div>
                <div className="space-y-2 sm:col-span-2"><Label>Senha inicial * (mín. 8 caracteres)</Label><Input type="password" autoComplete="new-password" {...register("admin_password", { required: true, minLength: 8 })} /></div>
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting}>Criar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
