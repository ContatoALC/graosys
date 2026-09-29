import { useEffect, useMemo, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BillingStatusBadge } from "@/components/BillingStatusBadge";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/services/api";
import { formatDate } from "@/lib/utils";

const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
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
const money = (v: number) => (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const tons = (kg: number) => `${(kg / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} t`;
const pct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}%`);
const statusVariant: Record<string, any> = { Ativo: "success", Cancelado: "destructive", "Em Execução": "warning", Encerrado: "secondary" };

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card><CardContent className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </CardContent></Card>
  );
}

// Situação de cobrança do contrato vista pelo broker: o que a corretora já recebeu libera a parte dele.
function releaseStatus(c: any): string {
  if (c.broker_commission <= 0) return "A Faturar";
  if (c.pending <= 0.005) return "Recebido";
  return c.released > 0 ? "Parcial" : "A Receber";
}

export function BrokerCommissionsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const [period, setPeriod] = useState("365");
  const [brokerId, setBrokerId] = useState("");
  const [tab, setTab] = useState<"broker" | "ranking">("broker");
  const [data, setData] = useState<any>(null);
  const [ranking, setRanking] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true); setError("");
    api.get("/api/broker-portal/summary", { params: { ...range(period), broker_id: brokerId || undefined } })
      .then((r) => { setData(r.data); if (!brokerId && r.data.broker) setBrokerId(r.data.broker.id); })
      .catch((e) => setError(e.response?.data?.error || "Não foi possível carregar as comissões"))
      .finally(() => setLoading(false));
  }, [period, brokerId]);

  useEffect(() => {
    if (isAdmin && tab === "ranking") api.get("/api/broker-portal/ranking", { params: range(period) }).then((r) => setRanking(r.data)).catch(console.error);
  }, [isAdmin, tab, period]);

  const monthly = useMemo(() => (data?.by_month ?? []).map((m: any) => ({ ...m, label: `${m.key.slice(5)}/${m.key.slice(2, 4)}` })), [data]);
  const k = data?.kpis;

  return (
    <div className="flex flex-col">
      <PageHeader
        title={isAdmin ? "Comissões dos Brokers" : "Minhas Comissões"}
        description={data?.broker ? `${data.broker.name} · % atual: ${pct(data.broker.current_percent)} da comissão da corretora` : "Comissões e produtividade por broker"}
      />
      <div className="flex-1 space-y-4 p-6">
        <Card><CardContent className={`grid gap-3 pt-4 ${isAdmin ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          {isAdmin && (
            <div className="flex gap-1 rounded-md border p-1">
              {(["broker", "ranking"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setTab(t)}
                  className={`flex-1 rounded px-3 py-1.5 text-sm font-medium ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  {t === "broker" ? "Por broker" : "Produtividade"}
                </button>
              ))}
            </div>
          )}
          {isAdmin && tab === "broker" && (
            <select className={selectClass} value={brokerId} onChange={(e) => setBrokerId(e.target.value)}>
              {(data?.brokers ?? []).map((b: any) => <option key={b.id} value={b.id}>{b.name}{b.active ? "" : " (inativo)"}</option>)}
            </select>
          )}
          <select className={selectClass} value={period} onChange={(e) => setPeriod(e.target.value)}>
            {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </CardContent></Card>

        {error ? <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          : isAdmin && tab === "ranking" ? (
            <Card>
              <CardHeader><CardTitle className="text-base">Produtividade dos brokers</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Broker</TableHead><TableHead className="text-right">Contratos</TableHead><TableHead className="text-right">Volume</TableHead>
                    <TableHead className="text-right">Comissão da corretora</TableHead><TableHead className="text-right">Comissão do broker</TableHead>
                    <TableHead className="text-right">Liberada</TableHead><TableHead className="text-right">A receber</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {ranking.length === 0 ? <TableRow><TableCell colSpan={7} className="h-16 text-center text-sm text-muted-foreground">Sem contratos com broker no período</TableCell></TableRow>
                      : ranking.map((r) => (
                        <TableRow key={r.broker_id} className="cursor-pointer" onClick={() => { setBrokerId(r.broker_id); setTab("broker"); }}>
                          <TableCell className="font-medium">{r.broker_name}</TableCell>
                          <TableCell className="text-right">{r.contracts}</TableCell>
                          <TableCell className="text-right">{tons(r.volume_kg)}</TableCell>
                          <TableCell className="text-right">{money(r.commission_contract)}</TableCell>
                          <TableCell className="text-right font-semibold">{money(r.broker_commission)}</TableCell>
                          <TableCell className="text-right">{money(r.released)}</TableCell>
                          <TableCell className="text-right">{money(r.pending)}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : loading && !data ? <p className="text-muted-foreground">Carregando...</p> : !k ? (
            <p className="text-muted-foreground">Nenhum broker cadastrado. Cadastre em Admin → Corretores/Brokers.</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Kpi label="Comissão do broker" value={money(k.broker_commission)} hint={`sobre ${money(k.commission_contract)} de comissão da corretora`} />
                <Kpi label="Liberada" value={money(k.released)} hint="proporcional ao que a corretora já recebeu" />
                <Kpi label="A receber" value={money(k.pending)} hint="libera quando a corretora receber" />
                <Kpi label="Contratos" value={String(k.contracts)} hint={`${tons(k.volume_kg)} · média ${money(k.average_ticket)} por contrato`} />
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                  <CardHeader><CardTitle className="text-base">Comissão por mês</CardTitle></CardHeader>
                  <CardContent className="h-64">
                    {monthly.length === 0 ? <p className="pt-16 text-center text-sm text-muted-foreground">Sem contratos no período</p> : (
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={monthly}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="label" fontSize={11} />
                          <YAxis fontSize={11} width={70} tickFormatter={(v) => money(v).replace(",00", "")} />
                          <Tooltip formatter={(v: number, n: string) => [money(v), n === "released" ? "Liberada" : "Comissão"]} />
                          <Legend formatter={(n) => (n === "released" ? "Liberada" : "Comissão")} />
                          <Bar dataKey="broker_commission" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                          <Bar dataKey="released" fill="#94a3b8" radius={[3, 3, 0, 0]} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-base">Por produto</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader><TableRow><TableHead>Produto</TableHead><TableHead className="text-right">Volume</TableHead><TableHead className="text-right">Comissão</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {data.by_product.length === 0 ? <TableRow><TableCell colSpan={3} className="h-16 text-center text-sm text-muted-foreground">Sem dados</TableCell></TableRow>
                          : data.by_product.map((p: any) => (
                            <TableRow key={p.key}><TableCell className="font-medium">{p.key}</TableCell><TableCell className="text-right">{tons(p.volume_kg)}</TableCell><TableCell className="text-right">{money(p.broker_commission)}</TableCell></TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader><CardTitle className="text-base">Contratos</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Status</TableHead><TableHead>Cobrança</TableHead><TableHead>Nº Contrato</TableHead><TableHead>Data</TableHead>
                      <TableHead>Produto</TableHead><TableHead>Vendedor / Comprador</TableHead><TableHead className="text-right">Comissão da corretora</TableHead>
                      <TableHead className="text-right">%</TableHead><TableHead className="text-right">Comissão do broker</TableHead><TableHead className="text-right">Liberada</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {data.contracts.length === 0 ? <TableRow><TableCell colSpan={10} className="h-16 text-center text-sm text-muted-foreground">Nenhum contrato no período</TableCell></TableRow>
                        : data.contracts.map((c: any) => (
                          <TableRow key={c.contract_id}>
                            <TableCell><Badge variant={statusVariant[c.status] ?? "outline"}>{c.status}</Badge></TableCell>
                            <TableCell><BillingStatusBadge status={releaseStatus(c)} /></TableCell>
                            <TableCell className="font-medium">{c.number_contract}</TableCell>
                            <TableCell>{formatDate(c.contract_date)}</TableCell>
                            <TableCell>{c.name_product}<br /><span className="text-xs text-muted-foreground">{c.crop}</span></TableCell>
                            <TableCell className="text-xs">{(c.seller || []).join(", ")}<br /><span className="text-muted-foreground">{(c.buyer || []).join(", ")}</span></TableCell>
                            <TableCell className="text-right">{money(c.commission_contract)}</TableCell>
                            <TableCell className="text-right">{pct(c.percent)}</TableCell>
                            <TableCell className="text-right font-semibold">{money(c.broker_commission)}</TableCell>
                            <TableCell className="text-right">{money(c.released)}</TableCell>
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
