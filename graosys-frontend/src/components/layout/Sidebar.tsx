import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  FileText,
  Users,
  Truck,
  DollarSign,
  BarChart3,
  Settings,
  User,
  LogOut,
  Wheat,
  ChevronLeft,
  Building2,
  Gauge,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Contratos", icon: FileText, path: "/contracts" },
  { label: "Clientes", icon: Users, path: "/clients" },
  { label: "Execução", icon: Truck, path: "/execution" },
  { label: "Cobrança", icon: DollarSign, path: "/billing" },
  { label: "Relatórios", icon: BarChart3, path: "/reports" },
];

const managementItem = { label: "Gerência", icon: Gauge, path: "/management" };

const platformItem = { label: "Painel de Controle", icon: Building2, path: "/platform" };

const bottomItems = [
  { label: "Admin", icon: Settings, path: "/admin" },
  { label: "Minha Conta", icon: User, path: "/my-account" },
];

export function Sidebar() {
  const { pathname } = useLocation();
  const { user, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const canSeeManagement = isAdmin || !!user?.permissions?.reports?.includes("view");
  const bottom = user?.role === "superadmin" ? [platformItem, ...bottomItems] : bottomItems;

  return (
    <aside className={cn("relative flex h-screen flex-col border-r bg-card transition-all duration-300", collapsed ? "w-16" : "w-60")}>
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
          <Wheat className="h-5 w-5 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div>
            <p className="text-sm font-bold leading-none">GraoSys</p>
            <p className="text-xs text-muted-foreground truncate max-w-[120px]">{user?.tenant_name}</p>
          </div>
        )}
      </div>

      {/* Collapse button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-5 z-10 h-6 w-6 rounded-full border bg-background shadow-sm"
      >
        <ChevronLeft className={cn("h-3 w-3 transition-transform", collapsed && "rotate-180")} />
      </Button>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-2 pt-4">
        {(canSeeManagement ? [...navItems, managementItem] : navItems).map((item) => {
          const active = pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t p-2 space-y-1">
        {isAdmin && bottom.map((item) => {
          const active = pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
        {!isAdmin && (
          <Link
            to="/my-account"
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname.startsWith("/my-account")
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <User className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Minha Conta</span>}
          </Link>
        )}
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  );
}
