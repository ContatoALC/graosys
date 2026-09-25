import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface Props {
  priceType: string;
  mode: string;
  currency: string;
  locked: boolean;
  onPriceType: (v: string) => void;
  onMode: (v: string) => void;
  register: (name: any, opts?: any) => any;
  hasError: boolean;
}

const MODES = [
  { value: "market", title: "Mercado", text: "O preço é o de mercado no dia de cada fixação. Você lança cada fixação com quantidade e preço." },
  { value: "frame", title: "Frame", text: "Preço composto por Chicago (CBOT) + prêmio + câmbio. Cada componente pode ser travado agora ou fixado depois." },
];

export function PriceModeSection({ priceType, mode, currency, locked, onPriceType, onMode, register, hasError }: Props) {
  const toFix = priceType === "to_fix";
  return (
    <div className="space-y-4 rounded-md border bg-muted/20 p-4">
      <div className="space-y-2">
        <Label>Tipo de preço</Label>
        <div className="flex gap-2">
          <Button type="button" variant={!toFix ? "default" : "outline"} disabled={locked} onClick={() => onPriceType("fixed")}>Preço fixo</Button>
          <Button type="button" variant={toFix ? "default" : "outline"} disabled={locked} onClick={() => onPriceType("to_fix")}>A fixar</Button>
        </div>
        {locked && <p className="text-xs text-muted-foreground">Há fixações lançadas: o tipo e a modalidade não podem ser alterados. Exclua as fixações para mudar.</p>}
      </div>

      {toFix && (
        <>
          <div className="space-y-2">
            <Label>Como será fixado?</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              {MODES.map((m) => (
                <button
                  key={m.value} type="button" disabled={locked} onClick={() => onMode(m.value)}
                  className={cn("rounded-md border p-3 text-left transition-colors disabled:cursor-not-allowed", mode === m.value ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-accent")}
                >
                  <p className="font-medium">{m.title}</p>
                  <p className="text-xs text-muted-foreground">{m.text}</p>
                </button>
              ))}
            </div>
          </div>

          {mode === "frame" && (
            <div className="space-y-3">
              <p className="text-sm font-medium">Componentes já travados neste contrato</p>
              <p className="text-xs text-muted-foreground">Preencha só o que já está fechado. O que ficar em branco será informado em cada fixação.</p>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2"><Label>Prêmio (c/bu)</Label><Input type="number" step="0.0001" placeholder="A fixar" disabled={locked} {...register("frame_premium")} /></div>
                <div className="space-y-2"><Label>Chicago (c/bu)</Label><Input type="number" step="0.0001" placeholder="A fixar" disabled={locked} {...register("frame_chicago")} /></div>
                {currency !== "USD" && <div className="space-y-2"><Label>Câmbio (R$/US$)</Label><Input type="number" step="0.000001" placeholder="A fixar" disabled={locked} {...register("frame_exchange")} /></div>}
              </div>
              <div className="space-y-2 sm:w-1/3"><Label>Referência CBOT</Label><Input placeholder="Ex.: SX26 (soja nov/26)" {...register("cbot_reference")} /></div>
            </div>
          )}

          <div className="space-y-2 sm:w-1/3">
            <Label>Prazo para fixação *</Label>
            <Input type="date" {...register("fixation_deadline", { required: true })} className={hasError ? "border-destructive" : ""} />
          </div>
        </>
      )}
    </div>
  );
}
