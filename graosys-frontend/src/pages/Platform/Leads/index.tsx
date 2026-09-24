import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { useForm } from "react-hook-form";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { api } from "@/services/api";
import { LEAD_STAGES, PlatformTabs, selectClass } from "../shared";

interface NewLeadForm { name: string; region: string; probable_plan: string; email: string; decision_maker: string; }

const today = () => new Date().toISOString().slice(0, 10);
const fmt = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("pt-BR");

export function PlatformLeadsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [error, setError] = useState("");
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<NewLeadForm>();

  function load(q = search) {
    setLoading(true);
    api.get("/api/platform/leads", { params: { search: q || undefined } })
      .then((r) => setLeads(r.data)).catch(console.error).finally(() => setLoading(false));
  }
  useEffect(() => { load(""); }, []);

  async function moveTo(lead: any, status: string) {
    const previous = leads;
    setLeads(leads.map((l) => (l.id === lead.id ? { ...l, status } : l)));
    try { await api.patch(`/api/platform/leads/${lead.id}`, { status }); }
    catch { setLeads(previous); alert("Erro ao mover o lead"); }
  }

  async function onSubmit(data: NewLeadForm) {
    setError("");
    try { await api.post("/api/platform/leads", data); setShowDialog(false); load(); }
    catch (e: any) { setError(e.response?.data?.error || "Erro ao criar lead"); }
  }

  return (
    <div className="flex flex-col">
      <PageHeader title="Painel de Controle" description="Gerencie as corretoras que usam o GraoSys" action={<Button onClick={() => { reset({ name: "", region: "", probable_plan: "", email: "", decision_maker: "" }); setError(""); setShowDialog(true); }}><Plus className="mr-2 h-4 w-4" />Novo lead</Button>} />
      <PlatformTabs />
      <div className="flex-1 space-y-4 p-6">
        <div className="flex items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar por nome, praça ou decisor..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load(search)} />
          </div>
          <Button variant="outline" onClick={() => load(search)}>Buscar</Button>
          {search && <Button variant="ghost" onClick={() => { setSearch(""); load(""); }}>Limpar</Button>}
        </div>

        {loading ? <p className="text-muted-foreground">Carregando...</p> : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {LEAD_STAGES.map((stage) => {
              const items = leads.filter((l) => l.status === stage.value);
              return (
                <div key={stage.value} className="w-64 shrink-0 space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-sm font-semibold">{stage.label}</p>
                    <Badge variant="outline">{items.length}</Badge>
                  </div>
                  <div className="min-h-[120px] space-y-2 rounded-lg bg-muted/40 p-2">
                    {items.map((l) => {
                      const overdue = l.next_step_date && l.next_step_date < today() && !["fechado", "perdido"].includes(l.status);
                      return (
                        <Card key={l.id}><CardContent className="space-y-2 p-3">
                          <Link to={`/platform/leads/${l.id}`} className="block font-medium hover:underline">{l.name}</Link>
                          {l.region && <p className="text-xs text-muted-foreground">{l.region}</p>}
                          {l.probable_plan && <Badge variant="outline">{l.probable_plan}</Badge>}
                          {l.decision_maker && <p className="text-xs">Decisor: {l.decision_maker}</p>}
                          {(l.next_step || l.next_step_date) && (
                            <p className={`text-xs ${overdue ? "font-medium text-destructive" : "text-muted-foreground"}`}>
                              {l.next_step}{l.next_step_date ? ` · ${fmt(l.next_step_date)}` : ""}
                            </p>
                          )}
                          <select className={`${selectClass} h-8 text-xs`} value={l.status} onChange={(e) => moveTo(l, e.target.value)}>
                            {LEAD_STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                          </select>
                        </CardContent></Card>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo lead</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2"><Label>Nome *</Label><Input {...register("name", { required: true })} /></div>
            <div className="space-y-2"><Label>Praças</Label><Input placeholder="Curitiba-PR" {...register("region")} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Provável plano</Label><Input placeholder="Profissional" {...register("probable_plan")} /></div>
              <div className="space-y-2"><Label>Decisor</Label><Input {...register("decision_maker")} /></div>
            </div>
            <div className="space-y-2"><Label>E-mail</Label><Input type="email" {...register("email")} /></div>
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
