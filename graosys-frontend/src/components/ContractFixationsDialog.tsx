import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { FixationsPanel } from "@/components/FixationsPanel";

const names = (v: unknown) => (Array.isArray(v) ? v.join(", ") : v ? String(v) : "—");

// Fixações de preço de um contrato a fixar, abertas a partir da linha do contrato nas listas.
export function ContractFixationsDialog({ contract, onClose, onChanged }: { contract: any | null; onClose: () => void; onChanged: () => void }) {
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || user?.role === "superadmin" || !!user?.permissions?.contracts?.includes("edit");
  return (
    <Dialog open={!!contract} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Contrato {contract?.number_contract}: fixações</DialogTitle>
          <DialogDescription>{contract ? `${names(contract.seller)} → ${names(contract.buyer)} · ${contract.name_product} · safra ${contract.crop}` : ""}</DialogDescription>
        </DialogHeader>
        {contract && <FixationsPanel embedded contract={contract} canEdit={canEdit} onChanged={onChanged} />}
      </DialogContent>
    </Dialog>
  );
}
