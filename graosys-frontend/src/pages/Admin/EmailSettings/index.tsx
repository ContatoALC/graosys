import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/services/api";

interface EmailSettingsForm {
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_user: string;
  smtp_pass: string;
  from_name: string;
  from_email: string;
  bcc_emails: string;
  signature: string;
  active: boolean;
}

const textareaClass = "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function AdminEmailSettingsPage() {
  const [hasPassword, setHasPassword] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<EmailSettingsForm>({
    defaultValues: { smtp_host: "", smtp_port: 587, smtp_secure: false, smtp_user: "", smtp_pass: "", from_name: "", from_email: "", bcc_emails: "", signature: "", active: true },
  });

  function load() {
    api.get("/api/email-settings").then((r) => {
      const s = r.data;
      if (!s) return;
      setHasPassword(s.has_password);
      reset({
        smtp_host: s.smtp_host, smtp_port: s.smtp_port, smtp_secure: s.smtp_secure, smtp_user: s.smtp_user, smtp_pass: "",
        from_name: s.from_name ?? "", from_email: s.from_email ?? "", bcc_emails: (s.bcc_emails || []).join("\n"),
        signature: s.signature ?? "", active: s.active,
      });
    }).catch(console.error);
  }
  useEffect(() => { load(); }, []);

  async function onSubmit(data: EmailSettingsForm) {
    setMessage(null);
    const bcc_emails = data.bcc_emails.split(/[\n,;]+/).map((e) => e.trim()).filter(Boolean);
    try {
      await api.put("/api/email-settings", { ...data, smtp_port: Number(data.smtp_port), bcc_emails, smtp_pass: data.smtp_pass || undefined });
      setMessage({ type: "ok", text: "Configuração salva" });
      load();
    } catch (e: any) {
      setMessage({ type: "error", text: e.response?.data?.error || "Erro ao salvar" });
    }
  }

  async function sendTest() {
    setMessage(null); setTesting(true);
    try {
      const r = await api.post("/api/email-settings/test");
      setMessage({ type: "ok", text: r.data.message });
    } catch (e: any) {
      setMessage({ type: "error", text: e.response?.data?.error || "Erro ao enviar teste" });
    } finally { setTesting(false); }
  }

  return (
    <div className="flex flex-col">
      <PageHeader title="E-mail da Corretora" description="Conta usada para enviar contratos em PDF aos clientes" />
      <div className="flex-1 p-6">
        <Card className="max-w-2xl"><CardContent className="pt-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-2"><Label>Servidor SMTP *</Label><Input placeholder="smtp.gmail.com" {...register("smtp_host", { required: true })} /></div>
              <div className="space-y-2"><Label>Porta *</Label><Input type="number" {...register("smtp_port", { required: true })} /></div>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register("smtp_secure")} className="h-4 w-4" />Conexão segura direta (SSL, porta 465)</label>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Usuário *</Label><Input autoComplete="off" {...register("smtp_user", { required: true })} /></div>
              <div className="space-y-2"><Label>Senha {hasPassword ? "(deixe vazio para manter)" : "*"}</Label><Input type="password" autoComplete="new-password" {...register("smtp_pass", { required: !hasPassword })} /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Nome do remetente</Label><Input {...register("from_name")} /></div>
              <div className="space-y-2"><Label>E-mail do remetente</Label><Input type="email" {...register("from_email")} /></div>
            </div>
            <div className="space-y-2"><Label>Cópia oculta (um e-mail por linha)</Label><textarea className={textareaClass} {...register("bcc_emails")} /></div>
            <div className="space-y-2"><Label>Assinatura do e-mail</Label><textarea className={textareaClass} {...register("signature")} /></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register("active")} className="h-4 w-4" />Usar esta configuração para envios</label>
            {message && <p className={message.type === "ok" ? "text-sm text-green-700" : "text-sm text-destructive"}>{message.text}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={isSubmitting}>Salvar</Button>
              <Button type="button" variant="outline" disabled={testing || !hasPassword} onClick={sendTest}>{testing ? "Enviando..." : "Enviar e-mail de teste"}</Button>
            </div>
          </form>
        </CardContent></Card>
      </div>
    </div>
  );
}
