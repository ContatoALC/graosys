import { PageHeader } from "@/components/layout/PageHeader";
import { SessionsView } from "@/components/SessionsView";

export function AdminSessionsPage() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Usuários Online" description="Quem está logado agora e métricas de acesso da sua corretora" />
      <div className="p-6"><SessionsView /></div>
    </div>
  );
}
