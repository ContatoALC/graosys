import { Link } from "react-router-dom";
import { Users, ShieldCheck, Package, Table2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";

const adminModules = [
  { label: "Usuários", description: "Gerenciar usuários da corretora", icon: Users, path: "/admin/users", color: "bg-blue-100 text-blue-700" },
  { label: "Controle de Acesso", description: "Permissões por usuário", icon: ShieldCheck, path: "/admin/access", color: "bg-purple-100 text-purple-700" },
  { label: "Produtos", description: "Grãos e commodities negociadas", icon: Package, path: "/admin/products", color: "bg-green-100 text-green-700" },
  { label: "Mesas de Preço", description: "Tabelas de preço por produto/safra", icon: Table2, path: "/admin/tables", color: "bg-primary/10 text-primary" },
];

export function AdminPage() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Administração" description="Configurações gerais da corretora" />
      <div className="p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {adminModules.map((m) => (
            <Link key={m.path} to={m.path}>
              <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
                <CardContent className="flex flex-col items-start gap-4 pt-6">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${m.color}`}>
                    <m.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-semibold">{m.label}</p>
                    <p className="text-sm text-muted-foreground">{m.description}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
