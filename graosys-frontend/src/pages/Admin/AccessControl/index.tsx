import { useEffect, useState } from "react";
import { ShieldCheck, Save } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/services/api";

const MODULES = [
  { key: "contracts", label: "Contratos" },
  { key: "clients", label: "Clientes" },
  { key: "execution", label: "Execução" },
  { key: "billing", label: "Cobrança" },
  { key: "reports", label: "Relatórios" },
];

const ACTIONS = ["view", "create", "edit", "delete"];

export function AdminAccessControlPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<Record<string, Record<string, string[]>>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    api.get("/api/users").then((r) => {
      setUsers(r.data);
      const init: Record<string, Record<string, string[]>> = {};
      r.data.forEach((u: any) => { init[u.id] = u.permissions || {}; });
      setPermissions(init);
    });
  }, []);

  function toggle(userId: string, module: string, action: string) {
    setPermissions((prev) => {
      const userPerms = { ...(prev[userId] || {}) };
      const modulePerms = [...(userPerms[module] || [])];
      const idx = modulePerms.indexOf(action);
      if (idx >= 0) modulePerms.splice(idx, 1);
      else modulePerms.push(action);
      userPerms[module] = modulePerms;
      return { ...prev, [userId]: userPerms };
    });
  }

  async function saveUser(userId: string) {
    setSaving(userId);
    try {
      await api.patch(`/api/users/${userId}`, { permissions: permissions[userId] });
      alert("Permissões salvas!");
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="flex flex-col">
      <PageHeader title="Controle de Acesso" description="Defina as permissões de cada usuário por módulo" />
      <div className="flex-1 space-y-4 p-6">
        {users.filter((u) => u.role !== "admin").map((u) => (
          <Card key={u.id}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                  {u.name}
                  <span className="text-xs font-normal text-muted-foreground">({u.email})</span>
                </div>
                <Button size="sm" onClick={() => saveUser(u.id)} disabled={saving === u.id}>
                  <Save className="mr-2 h-3 w-3" />
                  {saving === u.id ? "Salvando..." : "Salvar"}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="py-1 pr-4 text-left font-medium text-muted-foreground">Módulo</th>
                      {ACTIONS.map((a) => (
                        <th key={a} className="px-4 py-1 text-center capitalize font-medium text-muted-foreground">{a === "view" ? "Visualizar" : a === "create" ? "Criar" : a === "edit" ? "Editar" : "Excluir"}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {MODULES.map((m) => (
                      <tr key={m.key} className="border-t">
                        <td className="py-2 pr-4 font-medium">{m.label}</td>
                        {ACTIONS.map((a) => {
                          const checked = permissions[u.id]?.[m.key]?.includes(a) ?? false;
                          return (
                            <td key={a} className="px-4 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggle(u.id, m.key, a)}
                                className="h-4 w-4 cursor-pointer accent-primary"
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ))}

        {users.filter((u) => u.role !== "admin").length === 0 && (
          <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-lg border border-dashed">
            <ShieldCheck className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">Nenhum usuário não-admin para configurar permissões</p>
          </div>
        )}
      </div>
    </div>
  );
}
