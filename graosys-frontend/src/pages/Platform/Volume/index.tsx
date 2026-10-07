import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/services/api";
import { formatDate } from "@/lib/utils";
import { PlatformTabs, brl, selectClass } from "../shared";

type Metric = "contracts" | "tons" | "value_brl";
const METRICS: { value: Metric; label: string; title: string }[] = [
  { value: "contracts", label: "Contratos", title: "Contratos" },
  { value: "tons", label: "Toneladas", title: "Toneladas" },
  { value: "value_brl", label: "Valor (R$)", title: "Valor negociado (R$)" },
];
const PERIODS = [{ value: "365", label: "Últimos 12 meses" }, { value: "year", label: "Este ano" }, { value: "all", label: "Todo o período" }];
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const iso = (d: Date) => d.toISOString().slice(0, 10);
function range(period: string): { from?: string; to?: string } {
  const now = new Date();
  if (period === "all") return {};
  if (period === "year") return { from: `${now.getFullYear()}-01-01`, to: iso(now) };
  const from = new Date(now); from.setDate(from.getDate() - Number(period));
  return { from: iso(from), to: iso(now) };
}
const num = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const usd = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const compact = (m: Metric) => (v: number) =>
  m === "value_brl" ? `R$ ${v.toLocaleString("pt-BR", { notation: "compact", maximumFractionDigits: 1 })}` : num(v);
function fmt(m: Metric, v: number) {
  if (m === "tons") return `${num(v)} t`;
  if (m === "value_brl") return brl(v);
  return `${num(v)} ${v === 1 ? "contrato" : "contratos"}`;
}
const monthLabel = (key: string) => `${MONTHS[Number(key.slice(5, 7)) - 1]}/${key.slice(2, 4)}`;

// Meses sem contrato entram com zero, para o eixo do tempo não "encolher" os intervalos.
// Acima de 60 meses (ex.: dados antigos em "Todo o período") mostra só os meses com contrato.
function fillMonths(rows: any[]): any[] {
  if (rows.length < 2) return rows;
  const idx = (k: string) => Number(k.slice(0, 4)) * 12 + Number(k.slice(5, 7)) - 1;
  const first = idx(rows[0].month), last = idx(rows[rows.length - 1].month);
  if (last - first >= 60) return rows;
  const byKey = new Map(rows.map((r) => [r.month, r]));
  return Array.from({ length: last - first + 1 }, (_, i) => {
    const n = first + i;
    const key = `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, "0")}`;
    return byKey.get(key) ?? { month: key, contracts: 0, tons: 0, value_brl: 0, value_usd: 0, tenants: 0 };
  });
}

// Top N por métrica; o restante vira uma barra "Outras/Outros (n)".
const TOP = 10;
function topN(rows: any[], metric: Metric, nameKey: string, other: string) {
  const sorted = rows.filter((r) => r[metric] > 0).sort((a, b) => b[metric] - a[metric]);
  if (sorted.length <= TOP) return sorted;
  const rest = sorted.slice(TOP - 1);
  return [...sorted.slice(0, TOP - 1), { [nameKey]: `${other} (${rest.length})`, [metric]: rest.reduce((s, r) => s + r[metric], 0) }];
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card><CardContent className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </CardContent></Card>
  );
}

function ChartTooltip({ active, payload, label, metric }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-background px-3 py-2 text-xs shadow-sm">
      <p className="font-medium">{label}</p>
      <p className="text-muted-foreground">{fmt(metric, payload[0].value)}</p>
    </div>
  );
}

function Empty() {
  return <p className="pt-12 text-center text-sm text-muted-foreground">Sem contratos no período</p>;
}

function HorizontalBars({ title, rows, nameKey, metric }: { title: string; rows: any[]; nameKey: string; metric: Metric }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent style={{ height: Math.max(288, rows.length * 36 + 40) }}>
        {rows.length === 0 ? <Empty /> : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
              <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} tickFormatter={compact(metric)} allowDecimals={metric !== "contracts"} />
              <YAxis type="category" dataKey={nameKey} fontSize={11} width={150} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: "hsl(var(--muted))" }} content={<ChartTooltip metric={metric} />} />
              <Bar dataKey={metric} fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function PlatformVolumePage() {
  const [period, setPeriod] = useState("365");
  const [includeInternal, setIncludeInternal] = useState(false);
  const [metric, setMetric] = useState<Metric>("tons");
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    api.get("/api/platform/volume", { params: { ...range(period), include_internal: includeInternal || undefined } })
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.error || "Não foi possível carregar o volume"));
  }, [period, includeInternal]);

  const tenants: any[] = data?.tenants ?? [];
  const byTenant = useMemo(() => topN(tenants, metric, "name", "Outras"), [tenants, metric]);
  const byProduct = useMemo(() => topN(data?.products ?? [], metric, "product", "Outros"), [data, metric]);
  const monthly = useMemo(() => fillMonths(data?.monthly ?? []).map((m: any) => ({ ...m, label: monthLabel(m.month) })), [data]);
  const title = METRICS.find((m) => m.value === metric)!.title;
  const t = data?.totals;
  const inactive: any[] = data?.inactive ?? [];

  return (
    <div className="flex flex-col">
      <PageHeader title="Painel de Controle" description="Gerencie as corretoras que usam o GraoSys" />
      <PlatformTabs />
      <div className="flex-1 space-y-4 p-6">
        <Card><CardContent className="grid items-center gap-3 pt-4 lg:grid-cols-3">
          <div className="flex gap-1 rounded-md border p-1" role="group" aria-label="Métrica dos gráficos">
            {METRICS.map((m) => (
              <button key={m.value} type="button" aria-pressed={metric === m.value} onClick={() => setMetric(m.value)}
                className={`flex-1 rounded px-3 py-1.5 text-sm font-medium ${metric === m.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {m.label}
              </button>
            ))}
          </div>
          <select className={selectClass} aria-label="Período" value={period} onChange={(e) => setPeriod(e.target.value)}>
            {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4" checked={includeInternal} onChange={(e) => setIncludeInternal(e.target.checked)} />
            Incluir corretora interna (testes e demonstração)
          </label>
        </CardContent></Card>

        {error ? <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          : !data ? <p className="text-muted-foreground">Carregando...</p> : (
          <>
            {inactive.length > 0 && (
              <Card className="border-foreground/30" role="region" aria-label="Corretoras sem lançar contratos">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertTriangle className="h-4 w-4" aria-hidden />
                    {inactive.length} {inactive.length === 1 ? "corretora ativa" : "corretoras ativas"} sem lançar contratos há mais de {data.inactive_days} dias
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">Considera a data em que o contrato foi lançado no sistema, em qualquer período. Risco de cancelamento: vale um contato.</p>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader><TableRow><TableHead>Corretora</TableHead><TableHead>Último lançamento</TableHead><TableHead className="text-right">Dias sem lançar</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {inactive.map((r) => (
                        <TableRow key={r.tenant_id}>
                          <TableCell className="font-medium"><Link to={`/platform/tenants/${r.tenant_id}`} className="hover:underline">{r.name}</Link></TableCell>
                          <TableCell>{r.last_launch_date ? formatDate(r.last_launch_date) : <span className="text-muted-foreground">Nunca lançou contrato</span>}</TableCell>
                          <TableCell className="text-right">{r.last_launch_date ? num(r.days) : `${num(r.days)} desde o cadastro`}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Kpi label="Contratos" value={num(t.contracts)} hint="sem os cancelados" />
              <Kpi label="Toneladas negociadas" value={`${num(t.tons)} t`} />
              <Kpi label="Valor negociado" value={brl(t.value_brl)} hint={t.value_usd > 0 ? `+ ${usd(t.value_usd)} em contratos em dólar` : "contratos em R$"} />
              <Kpi label="Corretoras com contratos" value={num(t.tenants)} />
              <Kpi label="Cancelados" value={num(t.cancelled)} hint="fora do volume" />
            </div>

            <Card>
              <CardHeader><CardTitle className="text-base">{title} por mês</CardTitle></CardHeader>
              <CardContent className="h-72">
                {monthly.length === 0 ? <Empty /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthly} margin={{ right: 8 }}>
                      <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis fontSize={11} width={72} tickLine={false} axisLine={false} tickFormatter={compact(metric)} allowDecimals={metric !== "contracts"} />
                      <Tooltip cursor={{ fill: "hsl(var(--muted))" }} content={<ChartTooltip metric={metric} />} />
                      <Bar dataKey={metric} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <HorizontalBars title={`${title} por corretora`} rows={byTenant} nameKey="name" metric={metric} />
              <HorizontalBars title={`${title} por produto`} rows={byProduct} nameKey="product" metric={metric} />
            </div>

            <Card>
              <CardHeader><CardTitle className="text-base">Corretoras</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Corretora</TableHead><TableHead className="text-right">Contratos</TableHead><TableHead className="text-right">Toneladas</TableHead>
                    <TableHead className="text-right">% das toneladas</TableHead><TableHead className="text-right">Valor (R$)</TableHead>
                    <TableHead className="text-right">Cancelados</TableHead><TableHead>Último contrato</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {tenants.length === 0 ? <TableRow><TableCell colSpan={7} className="h-16 text-center text-sm text-muted-foreground">Sem contratos no período</TableCell></TableRow>
                      : tenants.map((r) => (
                        <TableRow key={r.tenant_id}>
                          <TableCell className="font-medium">{r.name} {r.internal && <Badge variant="outline" className="ml-1">Interna</Badge>}</TableCell>
                          <TableCell className="text-right">{num(r.contracts)}</TableCell>
                          <TableCell className="text-right">{num(r.tons)} t</TableCell>
                          <TableCell className="text-right">{t.tons ? `${num((r.tons / t.tons) * 100)}%` : "—"}</TableCell>
                          <TableCell className="text-right">{brl(r.value_brl)}</TableCell>
                          <TableCell className="text-right">{num(r.cancelled)}</TableCell>
                          <TableCell>{r.last_contract_date ? formatDate(r.last_contract_date) : "—"}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
