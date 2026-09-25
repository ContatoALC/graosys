import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { api } from "@/services/api";
import { framePricePreview, moneyFmt, qtyFmt } from "@/lib/pricing";

const STATUS: Record<string, { label: string; variant: any }> = {
  waiting: { label: "Aguardando fixação", variant: "warning" }, partial: { label: "Parcialmente fixado", variant: "outline" }, fixed: { label: "Totalmente fixado", variant: "success" },
};
const today = () => new Date().toISOString().slice(0, 10);
const dmy = (d: string) => d.split("-").reverse().join("/");

// Fixações de um contrato a fixar: saldo, preço médio, lançamento e exclusão. O servidor valida e calcula o preço.
export function FixationsPanel({ contract, canEdit, onChanged, embedded = false }: { contract: any; canEdit: boolean; onChanged: () => void; embedded?: boolean }) {
  const [data, setData] = useState<{ fixations: any[]; summary: any } | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const isFrame = contract.fixation_mode !== "market";
  const cur = contract.type_currency;
  const unit = contract.type_quantity;

  function load() { api.get(`/api/contracts/${contract.id}/fixations`).then((r) => setData(r.data)).catch(console.error); }
  useEffect(() => { load(); }, [contract.id]);

  const fixedComponent = (k: "frame_chicago" | "frame_premium" | "frame_exchange") => contract[k] !== null && contract[k] !== undefined && contract[k] !== "";

  function openNew() {
    setForm({
      fixation_date: today(), quantity: String(data?.summary.balance ?? ""), price: "", notes: "",
      chicago: fixedComponent("frame_chicago") ? String(Number(contract.frame_chicago)) : "",
      premium: fixedComponent("frame_premium") ? String(Number(contract.frame_premium)) : "",
      exchange_rate: fixedComponent("frame_exchange") ? String(Number(contract.frame_exchange)) : "",
    });
    setError(""); setOpen(true);
  }

  const preview = useMemo(() => isFrame
    ? framePricePreview({ chicago: Number(form.chicago), premium: Number(form.premium), exchange: Number(form.exchange_rate) }, { product: contract.name_product, unit, currency: cur })
    : null, [form, isFrame]);

  async function save() {
    setSaving(true); setError("");
    try {
      await api.post(`/api/contracts/${contract.id}/fixations`, {
        fixation_date: form.fixation_date, quantity: Number(form.quantity), notes: form.notes || undefined,
        ...(isFrame ? { chicago: form.chicago, premium: form.premium, exchange_rate: form.exchange_rate } : { price: Number(form.price) }),
      });
      setOpen(false); load(); onChanged();
    } catch (e: any) { setError(e.response?.data?.error || "Erro ao lançar fixação"); }
    finally { setSaving(false); }
  }

  async function remove(f: any) {
    if (!confirm(`Excluir a fixação de ${dmy(f.fixation_date)} (${qtyFmt(f.quantity)} ${unit})? O saldo e o preço médio serão recalculados.`)) return;
    try { await api.delete(`/api/contracts/${contract.id}/fixations/${f.id}`); load(); onChanged(); }
    catch (e: any) { alert(e.response?.data?.error || "Erro ao excluir"); }
  }

  if (!data) return null;
  const s = data.summary;
  const overdue = contract.fixation_deadline && contract.fixation_deadline < today() && s.balance > 0;
  const field = (k: string, label: string, locked: boolean, step = "0.0001") => (
    <div className="space-y-2">
      <Label>{label}{locked && <span className="ml-1 text-xs text-muted-foreground">(travado no contrato)</span>}</Label>
      <Input type="number" step={step} value={form[k] ?? ""} disabled={locked} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
    </div>
  );

  return (
    <Card className={embedded ? "border-0 shadow-none" : "mt-6"}>
      <CardHeader className={`flex-row items-center justify-between space-y-0 ${embedded ? "px-0 pt-0" : ""}`}>
        <div>
          <CardTitle className="text-base">Fixações de preço ({isFrame ? "Frame" : "Mercado"})</CardTitle>
          <p className="text-xs text-muted-foreground">
            Prazo: {contract.fixation_deadline ? dmy(contract.fixation_deadline) : "—"}{overdue && <span className="ml-2 font-medium text-destructive">prazo vencido com saldo a fixar</span>}
            {contract.cbot_reference && ` · CBOT ${contract.cbot_reference}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={STATUS[s.status].variant}>{STATUS[s.status].label}</Badge>
          {canEdit && s.balance > 0 && <Button size="sm" onClick={openNew}><Plus className="mr-2 h-4 w-4" />Nova fixação</Button>}
        </div>
      </CardHeader>
      <CardContent className={`space-y-4 ${embedded ? "px-0 pb-0" : ""}`}>
        <div>
          <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${Math.round(s.progress * 100)}%` }} /></div>
          <p className="mt-1 text-xs text-muted-foreground">{Math.round(s.progress * 100)}% fixado</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-5">
          {[["Contrato", `${qtyFmt(s.contract_quantity)} ${unit}`], ["Fixado", `${qtyFmt(s.fixed_quantity)} ${unit}`], ["Saldo a fixar", `${qtyFmt(s.balance)} ${unit}`],
            ["Preço médio", s.average_price === null ? "—" : moneyFmt(s.average_price, cur)], ["Valor fixado", moneyFmt(s.fixed_value, cur)]].map(([l, v]) => (
            <div key={l} className="rounded-md border p-3"><p className="text-xs text-muted-foreground">{l}</p><p className="font-semibold">{v}</p></div>
          ))}
        </div>

        <Table>
          <TableHeader><TableRow>
            <TableHead>Data</TableHead><TableHead className="text-right">Quantidade</TableHead>
            {isFrame && <><TableHead className="text-right">Chicago</TableHead><TableHead className="text-right">Prêmio</TableHead>{cur !== "USD" && <TableHead className="text-right">Câmbio</TableHead>}</>}
            <TableHead className="text-right">Preço / {unit}</TableHead><TableHead>Lançado por</TableHead><TableHead className="w-10" />
          </TableRow></TableHeader>
          <TableBody>
            {data.fixations.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="h-16 text-center text-sm text-muted-foreground">Nenhuma fixação lançada</TableCell></TableRow>
            ) : data.fixations.map((f) => (
              <TableRow key={f.id}>
                <TableCell>{dmy(f.fixation_date)}</TableCell><TableCell className="text-right">{qtyFmt(f.quantity)}</TableCell>
                {isFrame && <><TableCell className="text-right">{f.chicago ?? "—"}</TableCell><TableCell className="text-right">{f.premium ?? "—"}</TableCell>{cur !== "USD" && <TableCell className="text-right">{f.exchange_rate ?? "—"}</TableCell>}</>}
                <TableCell className="text-right font-medium">{moneyFmt(Number(f.price), cur)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{f.created_by_name ?? "—"}</TableCell>
                <TableCell>{canEdit && <Button variant="ghost" size="icon" className="text-destructive" onClick={() => remove(f)}><Trash2 className="h-4 w-4" /></Button>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova fixação</DialogTitle>
            <DialogDescription>Saldo a fixar: {qtyFmt(s.balance)} {unit}. {isFrame ? "Informe os componentes que ainda estão em aberto." : "Informe o preço de mercado do dia."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Data</Label><Input type="date" value={form.fixation_date ?? ""} onChange={(e) => setForm({ ...form, fixation_date: e.target.value })} /></div>
              {field("quantity", `Quantidade (${unit})`, false, "0.001")}
            </div>
            {isFrame ? (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  {field("premium", "Prêmio (c/bu)", fixedComponent("frame_premium"))}
                  {field("chicago", "Chicago (c/bu)", fixedComponent("frame_chicago"))}
                  {cur !== "USD" && field("exchange_rate", "Câmbio (R$/US$)", fixedComponent("frame_exchange"), "0.000001")}
                </div>
                <div className="rounded-md bg-muted/40 p-3 text-sm">
                  Prévia do preço: <strong>{preview === null ? "preencha os componentes" : `${moneyFmt(preview, cur)} / ${unit}`}</strong>
                  <p className="text-xs text-muted-foreground">O valor final é calculado e gravado pelo servidor.</p>
                </div>
              </>
            ) : field("price", `Preço de mercado (${cur === "USD" ? "US$" : "R$"} / ${unit})`, false)}
            <div className="space-y-2"><Label>Observação</Label><Input value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Lançar fixação"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
