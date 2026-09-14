import { useEffect, useState } from "react";
import { Plus, Search, DollarSign, CheckCircle, Clock } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/services/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useForm, Controller } from "react-hook-form";

interface BillingForm {
  number_contract: string;
  number_broker: string;
  product_name: string;
  year: string;
  receipt_date: string;
  rps_number: string;
  nfs_number: string;
  total_service_value: number;
  irrf_value: number;
  adjustment_value: number;
  liquid_value: number;
  expected_receipt_date: string;
  status: string;
  observation: string;
}

export function ReceiptPage() {
  const [billings, setBillings] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { register, handleSubmit, reset, control, watch, setValue } = useForm<BillingForm>({
    defaultValues: { status: "pending", year: new Date().getFullYear().toString() },
  });

  const totalService = watch("total_service_value");
  const irrfVal = watch("irrf_value");
  const adjustVal = watch("adjustment_value");

  useEffect(() => {
    const liquid = (Number(totalService) || 0) - (Number(irrfVal) || 0) + (Number(adjustVal) || 0);
    setValue("liquid_value", liquid);
  }, [totalService, irrfVal, adjustVal, setValue]);

  function load() {
    setIsLoading(true);
    api.get("/api/billings", { params: { limit: 100 } })
      .then((r) => { setBillings(r.data.data); setTotal(r.data.total); })
      .catch(console.error)
      .finally(() => setIsLoading(false));
    api.get("/api/billings/summary")
      .then((r) => setSummary(r.data.summary))
      .catch(console.error);
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    reset({ status: "pending", year: new Date().getFullYear().toString() });
    setEditingId(null);
    setShowDialog(true);
  }

  function openEdit(b: any) {
    reset(b);
    setEditingId(b.id);
    setShowDialog(true);
  }

  async function onSubmit(data: BillingForm) {
    try {
      if (editingId) {
        await api.patch(`/api/billings/${editingId}`, data);
      } else {
        await api.post("/api/billings", data);
      }
      setShowDialog(false);
      load();
    } catch (e: any) {
      alert(e.response?.data?.error || "Erro ao salvar");
    }
  }

  const filtered = search
    ? billings.filter((b) => b.number_contract?.includes(search) || b.number_broker?.includes(search))
    : billings;

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Recebimentos"
        description="Controle de comissões recebidas"
        action={<Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Novo Recebimento</Button>}
      />

      <div className="flex-1 space-y-4 p-6">
        {/* KPIs */}
        {summary && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Recebido</p>
                  <p className="font-bold">{formatCurrency(summary.totalReceived)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                  <Clock className="h-5 w-5 text-gray-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">A Receber</p>
                  <p className="font-bold">{formatCurrency(summary.totalPending)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total de Registros</p>
                  <p className="font-bold">{summary.total}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Search */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar por nº contrato ou broker..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº Contrato</TableHead>
                  <TableHead>Nº Broker</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Ano</TableHead>
                  <TableHead>Data Receb.</TableHead>
                  <TableHead className="text-right">Vlr. Serviço</TableHead>
                  <TableHead className="text-right">IRRF</TableHead>
                  <TableHead className="text-right">Vlr. Líquido</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>{[...Array(9)].map((_, j) => <TableCell key={j}><div className="h-4 animate-pulse rounded bg-muted" /></TableCell>)}</TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center">
                      <DollarSign className="mx-auto h-8 w-8 text-muted-foreground" />
                      <p className="mt-2 text-muted-foreground">Nenhum recebimento encontrado</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((b) => (
                    <TableRow key={b.id} className="cursor-pointer" onClick={() => openEdit(b)}>
                      <TableCell className="font-medium">{b.number_contract}</TableCell>
                      <TableCell>{b.number_broker}</TableCell>
                      <TableCell>{b.product_name}</TableCell>
                      <TableCell>{b.year}</TableCell>
                      <TableCell>{b.receipt_date ? formatDate(b.receipt_date) : "—"}</TableCell>
                      <TableCell className="text-right">{formatCurrency(b.total_service_value)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(b.irrf_value)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(b.liquid_value)}</TableCell>
                      <TableCell>
                        <Badge variant={b.status === "received" ? "success" : b.status === "cancelled" ? "destructive" : "warning"}>
                          {b.status === "received" ? "Recebido" : b.status === "cancelled" ? "Cancelado" : "Pendente"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Dialog Form */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Recebimento" : "Novo Recebimento"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nº Contrato</Label>
                <Input {...register("number_contract", { required: true })} />
              </div>
              <div className="space-y-2">
                <Label>Nº Broker</Label>
                <Input {...register("number_broker", { required: true })} />
              </div>
              <div className="space-y-2">
                <Label>Produto</Label>
                <Input {...register("product_name", { required: true })} />
              </div>
              <div className="space-y-2">
                <Label>Ano</Label>
                <Input {...register("year", { required: true })} />
              </div>
              <div className="space-y-2">
                <Label>Data Recebimento</Label>
                <Input type="date" {...register("receipt_date")} />
              </div>
              <div className="space-y-2">
                <Label>Data Prev. Recebimento</Label>
                <Input type="date" {...register("expected_receipt_date")} />
              </div>
              <div className="space-y-2">
                <Label>RPS</Label>
                <Input {...register("rps_number")} />
              </div>
              <div className="space-y-2">
                <Label>NFS</Label>
                <Input {...register("nfs_number")} />
              </div>
              <div className="space-y-2">
                <Label>Valor do Serviço (R$)</Label>
                <Input type="number" step="0.01" {...register("total_service_value")} />
              </div>
              <div className="space-y-2">
                <Label>IRRF (R$)</Label>
                <Input type="number" step="0.01" {...register("irrf_value")} />
              </div>
              <div className="space-y-2">
                <Label>Ajuste (R$)</Label>
                <Input type="number" step="0.01" {...register("adjustment_value")} />
              </div>
              <div className="space-y-2">
                <Label>Valor Líquido (R$)</Label>
                <Input type="number" step="0.01" {...register("liquid_value")} readOnly className="bg-muted" />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Status</Label>
                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="received">Recebido</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Observação</Label>
                <Input {...register("observation")} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
              <Button type="submit">{editingId ? "Salvar" : "Criar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
