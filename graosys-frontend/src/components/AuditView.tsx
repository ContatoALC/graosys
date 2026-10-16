import { Fragment, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/services/api";
import { actionLabel, fmtDateTime, parseUserAgent } from "@/lib/audit";
import { SimpleSelect } from "@/components/ui/simple-select";


interface Filters { search: string; action: string; result: string; from: string; to: string; tenant_id: string }
const EMPTY: Filters = { search: "", action: "", result: "", from: "", to: "", tenant_id: "" };

// Trilha de auditoria. Na corretora, o servidor já restringe ao tenant do usuário; na plataforma há filtro por corretora.
export function AuditView({ platform = false }: { platform?: boolean }) {
  const base = platform ? "/api/platform/audit" : "/api/audit";
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [actions, setActions] = useState<string[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const limit = 25;

  useEffect(() => {
    api.get(`${base}/actions`).then((r) => setActions(r.data)).catch(() => undefined);
    if (platform) api.get("/api/platform/tenants").then((r) => setTenants(r.data)).catch(() => undefined);
  }, [base, platform]);

  function load(f = filters, p = page) {
    setLoading(true);
    const params: Record<string, string | number> = { page: p, limit };
    (Object.keys(f) as (keyof Filters)[]).forEach((k) => { if (f[k]) params[k] = f[k]; });
    api.get(base, { params }).then((r) => { setRows(r.data.data); setTotal(r.data.total); }).catch(console.error).finally(() => setLoading(false));
  }
  useEffect(() => { load(filters, page); }, [page]);

  const apply = () => { setPage(1); load(filters, 1); };
  const clear = () => { setFilters(EMPTY); setPage(1); load(EMPTY, 1); };
  const tenantName = (id?: string | null) => tenants.find((t) => t.id === id)?.name ?? (id ? id.slice(0, 8) : "—");
  const set = (k: keyof Filters, v: string) => setFilters((f) => ({ ...f, [k]: v }));
  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-4">
      <Card><CardContent className="grid gap-3 pt-4 sm:grid-cols-2 lg:grid-cols-6">
        <div className="relative lg:col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Usuário, e-mail, ação ou id..." value={filters.search} onChange={(e) => set("search", e.target.value)} onKeyDown={(e) => e.key === "Enter" && apply()} />
        </div>
        <SimpleSelect aria-label="Ação" value={filters.action} onValueChange={(v) => set("action", v)}
          options={[{ value: "", label: "Todas as ações" }, ...actions.map((a) => ({ value: a, label: actionLabel(a) }))]} />
        <SimpleSelect aria-label="Resultado" value={filters.result} onValueChange={(v) => set("result", v)}
          options={[{ value: "", label: "Todos os resultados" }, { value: "ok", label: "Sucesso" }, { value: "error", label: "Erro / negado" }]} />
        <DatePicker value={filters.from} onChange={(v) => set("from", v)} title="De" aria-label="De" />
        <DatePicker value={filters.to} onChange={(v) => set("to", v)} title="Até" aria-label="Até" />
        {platform && (
          <SimpleSelect className="lg:col-span-2" aria-label="Corretora" value={filters.tenant_id} onValueChange={(v) => set("tenant_id", v)}
            options={[{ value: "", label: "Todas as corretoras" }, ...tenants.map((t) => ({ value: t.id, label: t.name }))]} />
        )}
        <div className="flex gap-2 lg:col-span-2">
          <Button onClick={apply}>Filtrar</Button>
          <Button variant="ghost" onClick={clear}>Limpar</Button>
        </div>
      </CardContent></Card>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" /><TableHead>Data/hora</TableHead>
              {platform && <TableHead>Corretora</TableHead>}
              <TableHead>Usuário</TableHead><TableHead>Ação</TableHead><TableHead>Registro</TableHead><TableHead>Resultado</TableHead><TableHead>IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={platform ? 8 : 7} className="h-24 text-center text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={platform ? 8 : 7} className="h-24 text-center text-muted-foreground">Nenhum evento encontrado</TableCell></TableRow>
            ) : rows.map((r) => (
              <Fragment key={r.id}>
                <TableRow className="cursor-pointer" onClick={() => setOpen(open === r.id ? null : r.id)}>
                  <TableCell>{open === r.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs">{fmtDateTime(r.created_at)}</TableCell>
                  {platform && <TableCell className="text-xs">{tenantName(r.tenant_id)}</TableCell>}
                  <TableCell className="text-xs"><p className="font-medium">{r.user_name ?? "—"}</p><p className="text-muted-foreground">{r.user_email}</p></TableCell>
                  <TableCell className="text-sm">{actionLabel(r.action)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.entity}{r.entity_id ? ` · ${String(r.entity_id).slice(0, 8)}` : ""}</TableCell>
                  <TableCell><Badge variant={!r.status_code || r.status_code < 400 ? "success" : "destructive"}>{!r.status_code || r.status_code < 400 ? "Sucesso" : `Erro ${r.status_code}`}</Badge></TableCell>
                  <TableCell className="text-xs">{r.ip ?? "—"}</TableCell>
                </TableRow>
                {open === r.id && (
                  <TableRow>
                    <TableCell />
                    <TableCell colSpan={platform ? 7 : 6} className="bg-muted/30 text-xs">
                      <div className="grid gap-1 sm:grid-cols-2">
                        <p><span className="text-muted-foreground">Requisição:</span> {r.method} {r.path}</p>
                        <p><span className="text-muted-foreground">Navegador:</span> {parseUserAgent(r.user_agent)}</p>
                        <p><span className="text-muted-foreground">Registro completo:</span> {r.entity_id ?? "—"}</p>
                        <p><span className="text-muted-foreground">Campos enviados:</span> {(r.metadata?.fields || []).join(", ") || "—"}</p>
                        {r.metadata?.status && <p><span className="text-muted-foreground">Novo status:</span> {r.metadata.status}</p>}
                        {r.metadata?.reason && <p><span className="text-muted-foreground">Motivo:</span> {r.metadata.reason}</p>}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total} evento(s)</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
          <span>Página {page} de {pages}</span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Próxima</Button>
        </div>
      </div>
    </div>
  );
}
