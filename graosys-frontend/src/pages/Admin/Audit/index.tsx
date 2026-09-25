import { PageHeader } from "@/components/layout/PageHeader";
import { AuditView } from "@/components/AuditView";

export function AdminAuditPage() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Auditoria" description="Quem fez o quê, quando e de onde, somente na sua corretora" />
      <div className="p-6"><AuditView /></div>
    </div>
  );
}
