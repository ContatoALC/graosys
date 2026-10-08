import { useEffect, useRef, useState } from "react";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/services/api";
import { toast } from "sonner";

const ROLES = [
  { role: "Vendedor", label: "Via do vendedor" },
  { role: "Comprador", label: "Via do comprador" },
] as const;

// Abre em nova aba o PDF do contrato (o mesmo anexado no e-mail), na via escolhida.
export function ContractPdfButton({ contractId }: { contractId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  async function openPdf(role: string) {
    setOpen(false);
    setLoading(true);
    // A aba é aberta já no clique: depois do await o navegador bloquearia como pop-up.
    const tab = window.open("", "_blank");
    try {
      const r = await api.get(`/api/contracts/${contractId}/pdf`, { params: { role }, responseType: "blob" });
      const url = URL.createObjectURL(new Blob([r.data], { type: "application/pdf" }));
      if (tab) tab.location.href = url;
      else window.open(url, "_blank");
    } catch {
      tab?.close();
      toast.error("Erro ao gerar o PDF do contrato");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div ref={ref} className="relative inline-block">
      <Button variant="ghost" size="icon" className="h-8 w-8" title="Ver PDF do contrato" aria-haspopup="menu" aria-expanded={open} disabled={loading} onClick={() => setOpen((v) => !v)}>
        <FileDown className="h-4 w-4" />
      </Button>
      {open && (
        <div role="menu" className="absolute right-0 z-20 mt-1 w-44 rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          {ROLES.map((r) => (
            <button key={r.role} type="button" role="menuitem" className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground" onClick={() => openPdf(r.role)}>
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
