import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useFieldArray, useForm } from "react-hook-form";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/services/api";
import { LEAD_STAGES, PlatformTabs, selectClass } from "../../shared";

interface LeadForm {
  name: string; region: string; status: string; probable_plan: string;
  phones: { label: string; number: string }[];
  email: string; address: string; cnpj: string; corporate_name: string; site: string;
  hook: string; decision_maker: string; whatsapp: string; next_step: string; next_step_date: string;
}

const textareaClass = "flex min-h-[90px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const STRING_FIELDS = ["name", "region", "probable_plan", "email", "address", "cnpj", "corporate_name", "site", "hook", "decision_maker", "whatsapp", "next_step"] as const;

export function PlatformLeadDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const { register, control, handleSubmit, reset, watch, formState: { isSubmitting } } = useForm<LeadForm>();
  const { fields, append, remove } = useFieldArray({ control, name: "phones" });
  const whatsapp = watch("whatsapp");

  useEffect(() => {
    api.get(`/api/platform/leads/${id}`).then((r) => {
      const l = r.data;
      const values: any = { status: l.status, phones: l.phones || [], next_step_date: l.next_step_date ? l.next_step_date.slice(0, 10) : "" };
      for (const f of STRING_FIELDS) values[f] = l[f] ?? "";
      reset(values); setLoaded(true);
    }).catch(console.error);
  }, [id]);

  async function onSubmit(f: LeadForm) {
    setMsg(null);
    try {
      await api.patch(`/api/platform/leads/${id}`, { ...f, phones: f.phones.filter((p) => p.number.trim()), next_step_date: f.next_step_date || null });
      setMsg({ type: "ok", text: "Lead salvo" });
    } catch (e: any) { setMsg({ type: "error", text: e.response?.data?.error || "Erro ao salvar" }); }
  }

  async function del() {
    if (!confirm("Remover este lead?")) return;
    await api.delete(`/api/platform/leads/${id}`);
    navigate("/platform/leads");
  }

  if (!loaded) return <div className="p-6 text-muted-foreground">Carregando...</div>;
  const waDigits = (whatsapp || "").replace(/\D/g, "");

  return (
    <div className="flex flex-col">
      <PageHeader title={watch("name") || "Lead"} description="Ficha de prospecção" action={<Button variant="outline" asChild><Link to="/platform/leads"><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Link></Button>} />
      <PlatformTabs />
      <div className="flex-1 p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="max-w-3xl space-y-6">
          <Card><CardContent className="space-y-4 pt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Nome *</Label><Input {...register("name", { required: true })} /></div>
              <div className="space-y-2"><Label>Etapa</Label><select className={selectClass} {...register("status")}>{LEAD_STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
              <div className="space-y-2"><Label>Praças</Label><Input {...register("region")} /></div>
              <div className="space-y-2"><Label>Provável plano</Label><Input {...register("probable_plan")} /></div>
            </div>
            <div className="space-y-2">
              <Label>Gancho da primeira ligação</Label>
              <textarea className={textareaClass} {...register("hook")} />
            </div>
          </CardContent></Card>

          <Card><CardContent className="space-y-4 pt-6">
            <p className="text-sm font-medium">Acompanhamento</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Decisor</Label><Input {...register("decision_maker")} /></div>
              <div className="space-y-2">
                <Label>WhatsApp {waDigits && <a className="ml-2 text-xs text-primary underline" href={`https://wa.me/${waDigits.startsWith("55") ? waDigits : "55" + waDigits}`} target="_blank" rel="noreferrer">abrir conversa</a>}</Label>
                <Input {...register("whatsapp")} />
              </div>
              <div className="space-y-2"><Label>Próximo passo</Label><Input {...register("next_step")} /></div>
              <div className="space-y-2"><Label>Data do próximo passo</Label><Input type="date" {...register("next_step_date")} /></div>
            </div>
          </CardContent></Card>

          <Card><CardContent className="space-y-4 pt-6">
            <p className="text-sm font-medium">Contato</p>
            <div className="space-y-2">
              <Label>Telefones</Label>
              {fields.map((f, i) => (
                <div key={f.id} className="flex gap-2">
                  <Input className="w-40" placeholder="Rótulo" {...register(`phones.${i}.label` as const)} />
                  <Input placeholder="(00) 0000-0000" {...register(`phones.${i}.number` as const)} />
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => append({ label: "Telefone", number: "" })}><Plus className="mr-2 h-4 w-4" />Adicionar telefone</Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>E-mail</Label><Input type="email" {...register("email")} /></div>
              <div className="space-y-2"><Label>Site</Label><Input {...register("site")} /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Endereço</Label><Input {...register("address")} /></div>
              <div className="space-y-2"><Label>Razão social</Label><Input {...register("corporate_name")} /></div>
              <div className="space-y-2"><Label>CNPJ</Label><Input {...register("cnpj")} /></div>
            </div>
          </CardContent></Card>

          {msg && <p className={msg.type === "ok" ? "text-sm text-green-700" : "text-sm text-destructive"}>{msg.text}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={isSubmitting}>Salvar</Button>
            <Button type="button" variant="ghost" className="text-destructive" onClick={del}>Remover lead</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
