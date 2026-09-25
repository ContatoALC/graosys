import { PageHeader } from "@/components/layout/PageHeader";
import { SessionsView } from "@/components/SessionsView";
import { PlatformTabs } from "../shared";

export function PlatformSessionsPage() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Painel de Controle" description="Gerencie as corretoras que usam o GraoSys" />
      <PlatformTabs />
      <div className="p-6"><SessionsView platform /></div>
    </div>
  );
}
