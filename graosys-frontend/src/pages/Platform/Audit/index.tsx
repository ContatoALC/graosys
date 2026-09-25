import { PageHeader } from "@/components/layout/PageHeader";
import { AuditView } from "@/components/AuditView";
import { PlatformTabs } from "../shared";

export function PlatformAuditPage() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Painel de Controle" description="Gerencie as corretoras que usam o GraoSys" />
      <PlatformTabs />
      <div className="p-6"><AuditView platform /></div>
    </div>
  );
}
