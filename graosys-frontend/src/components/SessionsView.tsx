import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/services/api";
import { duration, fmtDateTime, parseUserAgent } from "@/lib/audit";

const selectClass = "flex h-10 w-64 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const STATUS: Record<string, { label: string; variant: any }> = {
  online: { label: "Online", variant: "success" }, inactive: { label: "Inativa", variant: "warning" },
  ended: { label: "Encerrada", variant: "secondary" }, expired: { label: "Expirada", variant: "secondary" },
};

// Usuários logados e métricas de acesso. Atualiza sozinho a cada 30 s.
export function SessionsView({ platform = false }: { platform?: boolean }) {
  const [data, setData] = useState<any>(null);
  const [tenants, setTenants] = useState<any[]>([]);
  const [tenantId, setTenantId] = useState("");

  useEffect(() => { if (platform) api.get("/api/platform/tenants").then((r) => setTenants(r.data)).catch(() => undefined); }, [platform]);

  useEffect(() => {
    const load = () => api.get(platform ? "/api/platform/sessions/overview" : "/api/sessions/overview", { params: { tenant_id: tenantId || undefined } })
      .then((r) => setData(r.data)).catch(console.error);
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [platform, tenantId]);

  if (!data) return <p className="text-muted-foreground">Carregando...</p>;
  const k = data.kpis;
  const cards = [
    { label: "Online agora", value: k.online }, { label: "Logins hoje", value: k.logins_today },
    { label: "Usuários ativos (7 dias)", value: k.active_users_7d }, { label: "Sessões (7 dias)", value: k.sessions_7d },
    { label: "Falhas de login (7 dias)", value: k.failed_logins_7d, danger: k.failed_logins_7d > 0 },
  ];
  const tName = (id: string) => tenants.find((t) => t.id === id)?.name ?? id.slice(0, 8);

  return (
    <div className="space-y-4">
      {platform && (
        <select className={selectClass} value={tenantId} onChange={(e) => setTenantId(e.target.value)}>
          <option value="">Todas as corretoras</option>
          {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      )}

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <Card key={c.label}><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className={`text-2xl font-semibold ${c.danger ? "text-destructive" : ""}`}>{c.value}</p>
          </CardContent></Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Logins nos últimos 14 dias</CardTitle></CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.by_day.map((d: any) => ({ ...d, label: d.day.slice(8) + "/" + d.day.slice(5, 7) }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" fontSize={11} /><YAxis allowDecimals={false} fontSize={11} width={28} />
                <Tooltip formatter={(v: number, n: string) => [v, n === "logins" ? "Logins" : "Usuários distintos"]} />
                <Bar dataKey="logins" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                <Bar dataKey="users" fill="hsl(var(--muted-foreground))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Online agora ({data.online.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>{platform && <TableHead>Corretora</TableHead>}<TableHead>Usuário</TableHead><TableHead>Desde</TableHead><TableHead>Último sinal</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.online.length === 0 ? (
                  <TableRow><TableCell colSpan={platform ? 4 : 3} className="h-20 text-center text-sm text-muted-foreground">Ninguém online</TableCell></TableRow>
                ) : data.online.map((s: any) => (
                  <TableRow key={s.id}>
                    {platform && <TableCell className="text-xs">{tName(s.tenant_id)}</TableCell>}
                    <TableCell className="text-xs"><p className="font-medium">{s.user_name}</p><p className="text-muted-foreground">{s.user_email}</p></TableCell>
                    <TableCell className="text-xs">{duration(s.created_at)}</TableCell>
                    <TableCell className="text-xs">{fmtDateTime(s.last_seen_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {platform && !tenantId && data.by_tenant.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Por corretora</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Corretora</TableHead><TableHead className="text-right">Online</TableHead><TableHead className="text-right">Sessões (7 dias)</TableHead></TableRow></TableHeader>
              <TableBody>{data.by_tenant.map((t: any) => (
                <TableRow key={t.tenant_id}><TableCell>{t.name}</TableCell><TableCell className="text-right">{t.online}</TableCell><TableCell className="text-right">{t.sessions_7d}</TableCell></TableRow>
              ))}</TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Últimas sessões</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>{platform && <TableHead>Corretora</TableHead>}<TableHead>Usuário</TableHead><TableHead>Perfil</TableHead><TableHead>Início</TableHead><TableHead>Duração</TableHead><TableHead>IP</TableHead><TableHead>Navegador</TableHead><TableHead>Situação</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.recent.map((s: any) => (
                <TableRow key={s.id}>
                  {platform && <TableCell className="text-xs">{tName(s.tenant_id)}</TableCell>}
                  <TableCell className="text-xs"><p className="font-medium">{s.user_name}</p><p className="text-muted-foreground">{s.user_email}</p></TableCell>
                  <TableCell className="text-xs capitalize">{s.role}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs">{fmtDateTime(s.created_at)}</TableCell>
                  <TableCell className="text-xs">{duration(s.created_at, s.status === "online" ? null : (s.ended_at ?? s.last_seen_at))}</TableCell>
                  <TableCell className="text-xs">{s.ip ?? "—"}</TableCell>
                  <TableCell className="text-xs">{parseUserAgent(s.user_agent)}</TableCell>
                  <TableCell><Badge variant={STATUS[s.status]?.variant}>{STATUS[s.status]?.label ?? s.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
