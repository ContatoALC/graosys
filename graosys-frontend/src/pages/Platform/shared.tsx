import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

export const PLANS = [
  { value: "trial", label: "Trial" },
  { value: "essencial", label: "Essencial" },
  { value: "profissional", label: "Profissional" },
  { value: "corporativo", label: "Corporativo" },
];

export const LEAD_STAGES = [
  { value: "a_contatar", label: "A contatar" },
  { value: "ligacao_feita", label: "Ligação feita" },
  { value: "reuniao_marcada", label: "Reunião marcada" },
  { value: "demo_feita", label: "Demo feita" },
  { value: "proposta_enviada", label: "Proposta enviada" },
  { value: "fechado", label: "Fechado" },
  { value: "perdido", label: "Perdido" },
];

export function PlatformTabs() {
  const { pathname } = useLocation();
  const tabs = [
    { to: "/platform", label: "Corretoras", active: pathname === "/platform" || pathname.startsWith("/platform/tenants") },
    { to: "/platform/leads", label: "Prospecção", active: pathname.startsWith("/platform/leads") },
  ];
  return (
    <div className="flex gap-1 border-b px-6">
      {tabs.map((t) => (
        <Link key={t.to} to={t.to} className={cn("-mb-px border-b-2 px-4 py-2 text-sm font-medium", t.active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>{t.label}</Link>
      ))}
    </div>
  );
}

export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export const STATUSES = [
  { value: "active", label: "Ativa" },
  { value: "inactive", label: "Inativa" },
  { value: "suspended", label: "Suspensa" },
];

export const statusVariant: Record<string, any> = { active: "success", inactive: "secondary", suspended: "destructive" };

export const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export const label = (list: { value: string; label: string }[], v: string) => list.find((i) => i.value === v)?.label ?? v;

export function fmtDate(v?: string | null) {
  return v ? new Date(v).toLocaleDateString("pt-BR") : "—";
}

export function fmtDateTime(v?: string | null) {
  return v ? new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "Nunca";
}

export function isExpired(v?: string | null) {
  return !!v && new Date(v).getTime() < Date.now();
}
