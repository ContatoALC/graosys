import { useEffect, useState } from "react";
import { FileText, Users, DollarSign, Clock, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { api } from "@/services/api";
import { formatCurrency } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface DashboardData {
  kpis: {
    totalContracts: number;
    activeClients: number;
    totalReceived: number;
    totalPending: number;
  };
  recentContracts: any[];
}

function KpiCard({ title, value, icon: Icon, description, variant }: { title: string; value: string; icon: any; description?: string; variant?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
            {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
          </div>
          <div className={`flex h-12 w-12 items-center justify-center rounded-full ${variant === "success" ? "bg-green-100" : variant === "warning" ? "bg-gray-100" : "bg-primary/10"}`}>
            <Icon className={`h-6 w-6 ${variant === "success" ? "text-green-600" : variant === "warning" ? "text-gray-500" : "text-primary"}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const statusMap: Record<string, { label: string; variant: any }> = {
  Ativo: { label: "Ativo", variant: "success" },
  Cancelado: { label: "Cancelado", variant: "destructive" },
  Encerrado: { label: "Encerrado", variant: "secondary" },
  "Em Execução": { label: "Em Execução", variant: "warning" },
};

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.get("/api/dashboard/summary")
      .then((res) => setData(res.data))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="flex flex-col">
      <PageHeader title="Dashboard" description="Visão geral da corretora" />

      <div className="flex-1 space-y-6 p-6">
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}><CardContent className="pt-6"><div className="h-16 animate-pulse rounded-md bg-muted" /></CardContent></Card>
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <KpiCard title="Total de Contratos" value={String(data?.kpis.totalContracts ?? 0)} icon={FileText} />
              <KpiCard title="Clientes Ativos" value={String(data?.kpis.activeClients ?? 0)} icon={Users} />
              <KpiCard title="Recebido no Ano" value={formatCurrency(data?.kpis.totalReceived ?? 0)} icon={DollarSign} variant="success" />
              <KpiCard title="A Receber" value={formatCurrency(data?.kpis.totalPending ?? 0)} icon={Clock} variant="warning" />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUp className="h-4 w-4" />
                    Contratos Recentes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data?.recentContracts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum contrato encontrado.</p>
                  ) : (
                    <div className="space-y-3">
                      {data?.recentContracts.map((c) => {
                        const s = statusMap[c.status?.status_current] || { label: c.status?.status_current, variant: "outline" };
                        return (
                          <div key={c.id} className="flex items-center justify-between rounded-lg border p-3">
                            <div>
                              <p className="text-sm font-medium">{c.number_contract}</p>
                              <p className="text-xs text-muted-foreground">{c.name_product} · {c.crop}</p>
                            </div>
                            <div className="text-right">
                              <Badge variant={s.variant}>{s.label}</Badge>
                              <p className="mt-1 text-xs text-muted-foreground">{formatCurrency(c.total_contract_value)}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Resumo Financeiro</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={[
                      { name: "Recebido", valor: data?.kpis.totalReceived ?? 0 },
                      { name: "A Receber", valor: data?.kpis.totalPending ?? 0 },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Bar dataKey="valor" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
