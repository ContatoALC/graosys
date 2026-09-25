import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { api } from "@/services/api";
import { cn } from "@/lib/utils";

interface ClientOption { id: string; name: string; nickname?: string; cnpj_cpf?: string }

interface Props {
  value: string;
  onChange: (name: string) => void;
  placeholder?: string;
  className?: string;
}

// Campo de texto com busca na base de clientes da corretora. O texto livre continua permitido.
export function ClientPicker({ value, onChange, placeholder, className }: Props) {
  const [options, setOptions] = useState<ClientOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function search(term: string) {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setLoading(true);
      api.get("/api/clients", { params: { search: term || undefined, situation: "active", limit: 8 } })
        .then((r) => setOptions(r.data.data))
        .catch(() => setOptions([]))
        .finally(() => setLoading(false));
    }, 250);
  }

  return (
    <div ref={boxRef} className="relative flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        className={cn("pl-9", className)}
        placeholder={placeholder}
        value={value}
        autoComplete="off"
        onFocus={() => { setOpen(true); search(value); }}
        onChange={(e) => { onChange(e.target.value); setOpen(true); search(e.target.value); }}
      />
      {open && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          {loading && options.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">Buscando...</p>
          ) : options.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">Nenhum cliente encontrado. O texto digitado será usado.</p>
          ) : options.map((c) => (
            <button
              key={c.id}
              type="button"
              className="flex w-full flex-col rounded-sm px-3 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
              onClick={() => { onChange(c.name); setOpen(false); }}
            >
              <span className="font-medium">{c.name}</span>
              <span className="text-xs text-muted-foreground">{[c.nickname, c.cnpj_cpf].filter(Boolean).join(" · ")}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
