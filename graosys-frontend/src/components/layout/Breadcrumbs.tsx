import { useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

const LABELS: Record<string, string> = {
  dashboard: "Dashboard", contracts: "Contratos", new: "Novo", clients: "Clientes", execution: "Execução",
  billing: "Cobrança", receipt: "Recebimento", reports: "Relatórios", admin: "Administração", users: "Usuários",
  access: "Controle de Acesso", products: "Produtos", brokers: "Corretores/Brokers", email: "E-mail da Corretora",
  "pdf-layout": "Layout do PDF", tables: "Mesas", "my-account": "Minha Conta", platform: "Painel de Controle",
  leads: "Prospecção", tenants: "Corretoras",
};

// Segmentos dinâmicos (ids): o rótulo depende da seção anterior.
const DYNAMIC: Record<string, string> = {
  contracts: "Editar contrato", clients: "Editar cliente", tenants: "Detalhe da corretora", leads: "Ficha do lead",
};

// Segmentos sem página própria: aparecem no caminho mas não são links.
const NO_LINK = new Set(["tenants"]);

function historyIndex(): number {
  return (window.history.state?.idx as number | undefined) ?? 0;
}

export function Breadcrumbs() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  // Primeira página autenticada da sessão: voltar além dela levaria ao /login.
  const baseIdx = useRef(historyIndex());
  const maxIdx = useRef(historyIndex());

  useEffect(() => { maxIdx.current = Math.max(maxIdx.current, historyIndex()); }, [pathname]);

  const parts = pathname.split("/").filter(Boolean);
  const crumbs = parts.map((part, i) => {
    const known = LABELS[part];
    const label = known ?? DYNAMIC[parts[i - 1]] ?? part;
    return { label, to: "/" + parts.slice(0, i + 1).join("/"), link: i < parts.length - 1 && !NO_LINK.has(part) };
  });

  const idx = historyIndex();
  const canBack = idx > baseIdx.current;
  const canForward = idx < maxIdx.current;
  const isFirstPage = pathname === "/dashboard";
  return (
    <div className="flex items-center gap-2 border-b bg-background px-6 py-2">
      {canBack && (
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Voltar" onClick={() => navigate(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}
      {canForward && (
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Avançar" onClick={() => navigate(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}
      <nav aria-label="Caminho" className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
        <Link to="/dashboard" className="flex items-center hover:text-foreground" title="Início"><Home className="h-3.5 w-3.5" /></Link>
        {!isFirstPage && crumbs.map((c, i) => (
          <span key={c.to} className="flex min-w-0 items-center gap-1">
            <ChevronRight className="h-3 w-3 shrink-0" />
            {c.link ? <Link to={c.to} className="truncate hover:text-foreground">{c.label}</Link>
              : <span className={i === crumbs.length - 1 ? "truncate font-medium text-foreground" : "truncate"}>{c.label}</span>}
          </span>
        ))}
      </nav>
    </div>
  );
}
