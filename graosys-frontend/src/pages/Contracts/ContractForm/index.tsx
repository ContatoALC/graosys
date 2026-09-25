import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { ArrowLeft, Loader2, Plus, X } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/services/api";
import { ClientPicker } from "@/components/ClientPicker";
import { useAuth } from "@/contexts/AuthContext";
import { PriceModeSection } from "./PriceModeSection";
import { FixationsPanel } from "./FixationsPanel";

interface ContractForm {
  number_broker: string;
  number_contract: string;
  seller: { value: string }[];
  buyer: { value: string }[];
  list_email_seller: { value: string }[];
  list_email_buyer: { value: string }[];
  product: string;
  name_product: string;
  crop: string;
  quality: string;
  type_quantity: string;
  quantity: string;
  type_currency: string;
  price: string;
  price_type: string;
  fixation_mode: string;
  cbot_reference: string;
  fixation_deadline: string;
  frame_chicago: string;
  frame_premium: string;
  frame_exchange: string;
  type_icms: string;
  icms: string;
  payment: string;
  type_commission_seller: string;
  commission_seller: string;
  type_commission_buyer: string;
  commission_buyer: string;
  type_pickup: string;
  pickup: string;
  pickup_location: string;
  destination: string;
  complement_destination: string;
  inspection: string;
  contract_emission_date: string;
  initial_pickup_date: string;
  final_pickup_date: string;
  payment_date: string;
  owner_contract: string;
  number_external_contract_seller: string;
  number_external_contract_buyer: string;
  observation: string;
  internal_communication: string;
}

export function ContractFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(id);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [products, setProducts] = useState<any[]>([]);
  const [saved, setSaved] = useState<any | null>(null);
  const { user } = useAuth();
  const canEditContract = user?.role === "admin" || user?.role === "superadmin" || !!user?.permissions?.contracts?.includes("edit");

  const { register, handleSubmit, reset, control, setValue, watch, formState: { errors } } = useForm<ContractForm>({
    defaultValues: {
      type_quantity: "sc",
      type_currency: "BRL",
      price_type: "fixed",
      fixation_mode: "frame",
      seller: [{ value: "" }],
      buyer: [{ value: "" }],
      list_email_seller: [],
      list_email_buyer: [],
    },
  });

  const sellers = useFieldArray({ control, name: "seller" });
  const buyers = useFieldArray({ control, name: "buyer" });
  const emailsSeller = useFieldArray({ control, name: "list_email_seller" });
  const emailsBuyer = useFieldArray({ control, name: "list_email_buyer" });

  useEffect(() => {
    api.get("/api/products").then((r) => setProducts(r.data)).catch(console.error);
    if (isEditing) {
      api.get(`/api/contracts/${id}`).then((r) => {
        const d = r.data;
        reset({
          ...d,
          seller: (d.seller || []).map((v: string) => ({ value: v })),
          buyer: (d.buyer || []).map((v: string) => ({ value: v })),
          list_email_seller: (d.list_email_seller || []).map((v: string) => ({ value: v })),
          list_email_buyer: (d.list_email_buyer || []).map((v: string) => ({ value: v })),
          quantity: String(d.quantity ?? ""),
          price: String(d.price ?? ""),
          price_type: d.price_type ?? "fixed",
          fixation_mode: d.fixation_mode ?? "frame",
          cbot_reference: d.cbot_reference ?? "",
          fixation_deadline: d.fixation_deadline ?? "",
          frame_chicago: d.frame_chicago === null || d.frame_chicago === undefined ? "" : String(Number(d.frame_chicago)),
          frame_premium: d.frame_premium === null || d.frame_premium === undefined ? "" : String(Number(d.frame_premium)),
          frame_exchange: d.frame_exchange === null || d.frame_exchange === undefined ? "" : String(Number(d.frame_exchange)),
        });
        setSaved(d);
      }).catch(console.error);
    }
  }, [id]);

  function handleProductChange(productType: string) {
    const p = products.find((p) => p.product_type === productType);
    if (p) {
      setValue("product", p.product_type);
      setValue("name_product", p.name);
      if (!isEditing) {
        setValue("type_commission_seller", p.type_commission_seller || "");
        setValue("commission_seller", p.commission_seller || "");
        setValue("quality", p.quality || "");
      }
    }
  }

  async function onSubmit(data: ContractForm) {
    setIsSaving(true);
    setError("");
    try {
      const payload = {
        ...data,
        seller: data.seller.map((s) => s.value).filter(Boolean),
        buyer: data.buyer.map((b) => b.value).filter(Boolean),
        list_email_seller: data.list_email_seller.map((e) => e.value).filter(Boolean),
        list_email_buyer: data.list_email_buyer.map((e) => e.value).filter(Boolean),
        quantity: Number(data.quantity),
      } as any;
      const toFix = data.price_type === "to_fix";
      const frame = toFix && data.fixation_mode === "frame";
      const numOrNull = (v: string) => (v === "" || v === undefined ? null : Number(v));
      if (toFix) { delete payload.price; } else { payload.price = Number(data.price); }
      payload.fixation_mode = toFix ? data.fixation_mode : null;
      payload.fixation_deadline = toFix ? data.fixation_deadline : null;
      payload.cbot_reference = frame ? data.cbot_reference || null : null;
      payload.frame_chicago = frame ? numOrNull(data.frame_chicago) : null;
      payload.frame_premium = frame ? numOrNull(data.frame_premium) : null;
      payload.frame_exchange = frame && data.type_currency !== "USD" ? numOrNull(data.frame_exchange) : null;
      if (isEditing) {
        await api.patch(`/api/contracts/${id}`, payload);
      } else {
        await api.post("/api/contracts", payload);
      }
      navigate("/contracts");
    } catch (e: any) {
      setError(e.response?.data?.error || "Erro ao salvar contrato");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        title={isEditing ? "Editar Contrato" : "Novo Contrato"}
        description={isEditing ? "Altere os dados do contrato" : "Preencha os dados para registrar um novo contrato"}
        action={
          <Button variant="outline" onClick={() => navigate("/contracts")}>
            <ArrowLeft className="mr-2 h-4 w-4" />Voltar
          </Button>
        }
      />

      <div className="flex-1 p-6 max-w-4xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

          {/* Identificação */}
          <Card>
            <CardHeader><CardTitle className="text-base">Identificação</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nº Corretor/Broker *</Label>
                  <Input {...register("number_broker", { required: true })} className={errors.number_broker ? "border-destructive" : ""} />
                </div>
                <div className="space-y-2">
                  <Label>Nº Contrato *</Label>
                  <Input {...register("number_contract", { required: true })} className={errors.number_contract ? "border-destructive" : ""} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data de Emissão</Label>
                  <Input type="date" {...register("contract_emission_date")} />
                </div>
                <div className="space-y-2">
                  <Label>Responsável</Label>
                  <Input {...register("owner_contract")} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Partes */}
          <Card>
            <CardHeader><CardTitle className="text-base">Partes</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-6">
                {/* Vendedores */}
                <div className="space-y-2">
                  <Label>Vendedor(es) *</Label>
                  <div className="space-y-2">
                    {sellers.fields.map((field, i) => (
                      <div key={field.id} className="flex gap-2">
                        <Controller name={`seller.${i}.value`} control={control} rules={{ required: i === 0 }} render={({ field: f }) => (<ClientPicker value={f.value} onChange={f.onChange} placeholder="Buscar ou digitar o vendedor" />)} />
                        {sellers.fields.length > 1 && (
                          <Button type="button" variant="ghost" size="icon" onClick={() => sellers.remove(i)}>
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => sellers.append({ value: "" })}>
                      <Plus className="mr-1 h-3 w-3" />Adicionar
                    </Button>
                  </div>
                  <Label className="text-xs text-muted-foreground mt-2 block">E-mails do Vendedor</Label>
                  <div className="space-y-2">
                    {emailsSeller.fields.map((field, i) => (
                      <div key={field.id} className="flex gap-2">
                        <Input {...register(`list_email_seller.${i}.value`)} type="email" placeholder="email@exemplo.com" />
                        <Button type="button" variant="ghost" size="icon" onClick={() => emailsSeller.remove(i)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => emailsSeller.append({ value: "" })}>
                      <Plus className="mr-1 h-3 w-3" />Adicionar e-mail
                    </Button>
                  </div>
                </div>

                {/* Compradores */}
                <div className="space-y-2">
                  <Label>Comprador(es) *</Label>
                  <div className="space-y-2">
                    {buyers.fields.map((field, i) => (
                      <div key={field.id} className="flex gap-2">
                        <Controller name={`buyer.${i}.value`} control={control} rules={{ required: i === 0 }} render={({ field: f }) => (<ClientPicker value={f.value} onChange={f.onChange} placeholder="Buscar ou digitar o comprador" />)} />
                        {buyers.fields.length > 1 && (
                          <Button type="button" variant="ghost" size="icon" onClick={() => buyers.remove(i)}>
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => buyers.append({ value: "" })}>
                      <Plus className="mr-1 h-3 w-3" />Adicionar
                    </Button>
                  </div>
                  <Label className="text-xs text-muted-foreground mt-2 block">E-mails do Comprador</Label>
                  <div className="space-y-2">
                    {emailsBuyer.fields.map((field, i) => (
                      <div key={field.id} className="flex gap-2">
                        <Input {...register(`list_email_buyer.${i}.value`)} type="email" placeholder="email@exemplo.com" />
                        <Button type="button" variant="ghost" size="icon" onClick={() => emailsBuyer.remove(i)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => emailsBuyer.append({ value: "" })}>
                      <Plus className="mr-1 h-3 w-3" />Adicionar e-mail
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Produto */}
          <Card>
            <CardHeader><CardTitle className="text-base">Produto</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Produto *</Label>
                  <Controller name="product" control={control} rules={{ required: true }} render={({ field }) => (
                    <Select value={field.value} onValueChange={(v) => { field.onChange(v); handleProductChange(v); }}>
                      <SelectTrigger className={errors.product ? "border-destructive" : ""}><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.product_type}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )} />
                </div>
                <div className="space-y-2">
                  <Label>Safra *</Label>
                  <Input {...register("crop", { required: true })} placeholder="2024/2025" className={errors.crop ? "border-destructive" : ""} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Qualidade</Label>
                <Input {...register("quality")} placeholder="Descreva a qualidade/especificações" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Quantidade *</Label>
                  <Input type="number" step="0.0001" {...register("quantity", { required: true })} className={errors.quantity ? "border-destructive" : ""} />
                </div>
                <div className="space-y-2">
                  <Label>Unidade</Label>
                  <Controller name="type_quantity" control={control} render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sc">Saca (sc)</SelectItem>
                        <SelectItem value="kg">Kg</SelectItem>
                        <SelectItem value="ton">Tonelada</SelectItem>
                      </SelectContent>
                    </Select>
                  )} />
                </div>
                <div className="space-y-2">
                  <Label>Moeda</Label>
                  <Controller name="type_currency" control={control} render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BRL">Real (R$)</SelectItem>
                        <SelectItem value="USD">Dólar (US$)</SelectItem>
                      </SelectContent>
                    </Select>
                  )} />
                </div>
              </div>
              <PriceModeSection
                priceType={watch("price_type")} mode={watch("fixation_mode")} currency={watch("type_currency")}
                locked={isEditing && Number(saved?.fixed_quantity) > 0}
                onPriceType={(v) => setValue("price_type", v, { shouldDirty: true })} onMode={(v) => setValue("fixation_mode", v, { shouldDirty: true })}
                register={register as any} hasError={!!errors.fixation_deadline}
              />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  {watch("price_type") === "to_fix" ? (
                    <><Label>Preço</Label><p className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">Definido pelas fixações. O preço médio aparece após o primeiro lançamento.</p></>
                  ) : (
                    <><Label>Preço *</Label>
                    <Input type="number" step="0.0001" {...register("price", { required: watch("price_type") !== "to_fix" })} className={errors.price ? "border-destructive" : ""} /></>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Pagamento</Label>
                  <Input {...register("payment")} placeholder="Ex.: À vista, 30/60 dias" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ICMS e Comissões */}
          <Card>
            <CardHeader><CardTitle className="text-base">ICMS e Comissões</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo ICMS</Label>
                  <Input {...register("type_icms")} placeholder="Ex.: ICMS diferido, isento" />
                </div>
                <div className="space-y-2">
                  <Label>ICMS</Label>
                  <Input {...register("icms")} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo Comissão Vendedor</Label>
                  <Controller name="type_commission_seller" control={control} render={({ field }) => (
                    <Select value={field.value || ""} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="%">Percentual (%)</SelectItem>
                        <SelectItem value="R$/sc">R$/Saca</SelectItem>
                        <SelectItem value="R$/ton">R$/Tonelada</SelectItem>
                      </SelectContent>
                    </Select>
                  )} />
                </div>
                <div className="space-y-2">
                  <Label>Comissão Vendedor</Label>
                  <Input {...register("commission_seller")} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo Comissão Comprador</Label>
                  <Controller name="type_commission_buyer" control={control} render={({ field }) => (
                    <Select value={field.value || ""} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="%">Percentual (%)</SelectItem>
                        <SelectItem value="R$/sc">R$/Saca</SelectItem>
                        <SelectItem value="R$/ton">R$/Tonelada</SelectItem>
                      </SelectContent>
                    </Select>
                  )} />
                </div>
                <div className="space-y-2">
                  <Label>Comissão Comprador</Label>
                  <Input {...register("commission_buyer")} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Retirada e Destino */}
          <Card>
            <CardHeader><CardTitle className="text-base">Retirada e Destino</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Retirada</Label>
                  <Input {...register("type_pickup")} placeholder="Ex.: FOB, CIF" />
                </div>
                <div className="space-y-2">
                  <Label>Retirada</Label>
                  <Input {...register("pickup")} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Local de Retirada</Label>
                <Input {...register("pickup_location")} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Destino</Label>
                  <Input {...register("destination")} />
                </div>
                <div className="space-y-2">
                  <Label>Complemento Destino</Label>
                  <Input {...register("complement_destination")} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Inspeção</Label>
                <Input {...register("inspection")} />
              </div>
            </CardContent>
          </Card>

          {/* Datas */}
          <Card>
            <CardHeader><CardTitle className="text-base">Datas e Referências Externas</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Início Retirada</Label>
                  <Input type="date" {...register("initial_pickup_date")} />
                </div>
                <div className="space-y-2">
                  <Label>Fim Retirada</Label>
                  <Input type="date" {...register("final_pickup_date")} />
                </div>
                <div className="space-y-2">
                  <Label>Data de Pagamento</Label>
                  <Input type="date" {...register("payment_date")} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nº Contrato Externo Vendedor</Label>
                  <Input {...register("number_external_contract_seller")} />
                </div>
                <div className="space-y-2">
                  <Label>Nº Contrato Externo Comprador</Label>
                  <Input {...register("number_external_contract_buyer")} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Observações */}
          <Card>
            <CardHeader><CardTitle className="text-base">Observações</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Observação</Label>
                <textarea
                  {...register("observation")}
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                />
              </div>
              <div className="space-y-2">
                <Label>Comunicação Interna</Label>
                <textarea
                  {...register("internal_communication")}
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                />
              </div>
            </CardContent>
          </Card>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}

          <div className="flex gap-3">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : isEditing ? "Salvar Alterações" : "Registrar Contrato"}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate("/contracts")}>Cancelar</Button>
          </div>
        </form>

        {isEditing && saved?.price_type === "to_fix" && (
          <FixationsPanel
            contract={saved} canEdit={canEditContract}
            onChanged={() => api.get(`/api/contracts/${id}`).then((r) => setSaved(r.data)).catch(console.error)}
          />
        )}
      </div>
    </div>
  );
}
