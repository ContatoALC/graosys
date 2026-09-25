import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/services/api";

const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const COLORS = ["#3f6b37", "#b9791f", "#2563eb", "#9333ea", "#dc2626", "#0d9488", "#64748b"];
const PERIODS = [
  { value: "30", label: "Últimos 30 dias" }, { value: "90", label: "Últimos 90 dias" }, { value: "365", label: "Últimos 12 meses" },
  { value: "year", label: "Este ano" }, { value: "all", label: "Todo o período" },
];

const iso = (d: Date) => d.toISOString().slice(0, 10);
function range(period: string): { from?: string; to?: string } {
  const now = new Date();
  if (period === "all") return {};
  if (period === "year") return { from: `${now.getFullYear()}-01-01`, to: iso(now) };
  const from = new Date(now); from.setDate(from.getDate() - Number(period));
  return { from: iso(from), to: iso(now) };
}
const money = (v: number, currency = "BRL") => v.toLocaleString(currency === "USD" ? "en-US" : "pt-BR", { style: "currency", currency: currency === "USD" ? "USD" : "BRL", maximumFractionDigits: 0 });
const tons = (kg: number) => `${(kg / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} t`;

function Kpi({ label, value, hint, danger }: { label: string; value: string; hint?: string; danger?: boolean }) {
  return (
    <Card><CardContent className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-semibold ${danger ? "text-destructive" : ""}`}>{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </CardContent></Card>
  );
}

function RankTable({ title, rows, cols }: { title: string; rows: any[]; cols: { key: string; label: string; fmt?: (v: any) => string; right?: boolean }[] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>{cols.map((c) => <TableHead key={c.key} className={c.right ? "text-right" : ""}>{c.label}</TableHead>)}</TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 ? <TableRow><TableCell colSpan={cols.length} className="h-16 text-center text-sm text-muted-foreground">Sem dados</TableCell></TableRow>
              : rows.map((r, i) => <TableRow key={i}>{cols.map((c) => <TableCell key={c.key} className={c.right ? "text-right" : "font-medium"}>{c.fmt ? c.fmt(r[c.key]) : r[c.key]}</TableCell>)}</TableRow>)}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function ManagementPage() {
  const [period, setPeriod] = useState("365");
  const [crop, setCrop] = useState("");
  const [product, setProduct] = useState("");
  const [products, setProducts] = useState<any[]>([]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.get("/api/products").then((r) => setProducts(r.data)).catch(() => undefined); }, []);
  useEffect(() => {
    setLoading(true);
    api.get("/api/dashboard/management", { params: { ...range(period), crop: crop || undefined, product: product || undefined } })
      .then((r) => setData(r.data)).catch(console.error).finally(() => setLoading(false));
  }, [period, crop, product]);

  const monthly = useMemo(() => (data?.by_month ?? []).map((m: any) => ({ ...m, label: `${m.month.slice(5)}/${m.month.slice(2, 4)}`, tons: Math.round(m.volume_kg / 1000) })), [data]);
  const k = data?.kpis;

  return (
    <div className="flex flex-col">
      <PageHeader title="Gerência" description="Indicadores de contratos, volume, comissões e recebimentos da sua corretora" />
      <div className="flex-1 space-y-4 p-6">
        <Card><CardContent className="grid gap-3 pt-4 sm:grid-cols-3">
          <select className={selectClass} value={period} onChange={(e) => setPeriod(e.target.value)}>{PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select>
          <Input placeholder="Safra (ex.: 2025/2026)" value={crop} onChange={(e) => setCrop(e.target.value)} />
          <select className={selectClass} value={product} onChange={(e) => setProduct(e.target.value)}>
            <option value="">Todos os produtos</option>{products.map((p) => <option key={p.id} value={p.product_type}>{p.name}</option>)}
          </select>
        </CardContent></Card>

        {loading && !data ? <p className="text-muted-foreground">Carregando...</p> : !data ? null : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi label="Contratos" value={String(k.contracts)} hint={`${k.open_contracts} em aberto`} />
              <Kpi label="Volume negociado" value={tons(k.volume_kg)} />
              <Kpi label="Comissão total" value={money(k.commission_total)} hint={`Vendedor ${money(k.commission_seller)} · Comprador ${money(k.commission_buyer)}`} />
              <Kpi label="Clientes ativos" value={String(k.active_clients)} hint={`de ${k.total_clients} cadastrados`} />
              {data.value_by_currency.map((v: any) => <Kpi key={v.currency} label={`Valor dos contratos (${v.currency})`} value={money(v.total, v.currency)} hint={`${v.contracts} contrato(s)`} />)}
              <Kpi label="Recebido" value={money(data.receivables.received)} />
              <Kpi label="A receber" value={money(data.receivables.pending)} />
              <Kpi label="Em atraso" value={money(data.receivables.overdue)} hint={`${data.receivables.overdue_count} recebimento(s)`} danger={data.receivables.overdue > 0} />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader><CardTitle className="text-base">Contratos e volume por mês</CardTitle></CardHeader>
                <CardContent className="h-64">
                  {monthly.length === 0 ? <p className="pt-16 text-center text-sm text-muted-foreground">Sem contratos no período</p> : (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={monthly}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="label" fontSize={11} />
                        <YAxis yAxisId="l" allowDecimals={false} fontSize={11} width={32} />
                        <YAxis yAxisId="r" orientation="right" fontSize={11} width={44} />
                        <Tooltip formatter={(v: number, n: string) => [n === "tons" ? `${v} t` : v, n === "tons" ? "Volume" : "Contratos"]} />
                        <Legend formatter={(n) => (n === "tons" ? "Volume (t)" : "Contratos")} />
                        <Bar yAxisId="l" dataKey="contracts" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                        <Line yAxisId="r" dataKey="tons" stroke="#b9791f" strokeWidth={2} dot />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Contratos por status</CardTitle></CardHeader>
                <CardContent className="h-64">
                  {data.by_status.length === 0 ? <p className="pt-16 text-center text-sm text-muted-foreground">Sem dados</p> : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={data.by_status} dataKey="contracts" nameKey="status" innerRadius={45} outerRadius={80} paddingAngle={2}>
                          {data.by_status.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip /><Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle className="text-base">Volume por produto (t)</CardTitle></CardHeader>
              <CardContent className="h-64">
                {data.by_product.length === 0 ? <p className="pt-16 text-center text-sm text-muted-foreground">Sem dados</p> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.by_product.map((p: any) => ({ ...p, tons: Math.round(p.volume_kg / 1000) }))} layout="vertical" margin={{ left: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" fontSize={11} /><YAxis type="category" dataKey="product" fontSize={11} width={120} />
                      <Tooltip formatter={(v: number) => [`${v} t`, "Volume"]} />
                      <Bar dataKey="tons" fill="#3f6b37" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-3">
              <RankTable title="Principais vendedores" rows={data.top_sellers} cols={[{ key: "name", label: "Vendedor" }, { key: "contracts", label: "Contratos", right: true }, { key: "volume_kg", label: "Volume", right: true, fmt: tons }]} />
              <RankTable title="Principais compradores" rows={data.top_buyers} cols={[{ key: "name", label: "Comprador" }, { key: "contracts", label: "Contratos", right: true }, { key: "volume_kg", label: "Volume", right: true, fmt: tons }]} />
              <RankTable title="Por responsável" rows={data.by_owner} cols={[{ key: "owner", label: "Responsável" }, { key: "contracts", label: "Contratos", right: true }, { key: "commission", label: "Comissão", right: true, fmt: (v) => money(v) }]} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
