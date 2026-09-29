import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { AlertTriangle, ArrowLeft, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { api } from "@/services/api";
import { COUNTRIES, countryCodeFor } from "@/lib/countries";

interface ClientForm {
  name: string;
  nickname: string;
  kind: string;
  cnpj_cpf: string;
  situation: string;
  telephone: string;
  cellphone: string;
  address: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  country_code: string;
  ins_est: string;
  ins_mun: string;
}

export function ClientFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(id);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const [lookingUp, setLookingUp] = useState<"cnpj" | "cep" | null>(null);
  const [lookupMsg, setLookupMsg] = useState<{ field: "cnpj" | "cep"; text: string; warn?: boolean } | null>(null);
  const lastCep = useRef("");

  const { register, handleSubmit, reset, control, setValue, getValues, formState: { errors } } = useForm<ClientForm>({
    defaultValues: { kind: "PJ", situation: "active", country: "Brasil", country_code: "BR" },
  });

  useEffect(() => {
    if (isEditing) {
      api.get(`/api/clients/${id}`).then((r) => {
        reset(r.data);
        lastCep.current = digitsOf(r.data.zip_code);
      }).catch(console.error);
    }
  }, [id]);

  // CNPJ: preenche só os campos ainda vazios, para não sobrescrever o que o usuário já digitou.
  async function lookupCnpj() {
    const cnpj = digitsOf(getValues("cnpj_cpf"));
    if (getValues("kind") !== "PJ" || cnpj.length !== 14) return;
    setLookingUp("cnpj");
    setLookupMsg(null);
    try {
      const { data } = await api.get(`/api/lookup/cnpj/${cnpj}`);
      for (const field of ["name", "nickname", "address", "number", "complement", "district", "city", "state", "zip_code", "telephone"] as const) {
        if (data[field] && !getValues(field)) setValue(field, data[field], { shouldDirty: true });
      }
      if (data.zip_code) lastCep.current = digitsOf(data.zip_code);
      if (data.registration_status && data.registration_status !== "ATIVA") {
        setLookupMsg({ field: "cnpj", text: `Situação na Receita: ${data.registration_status}`, warn: true });
      } else {
        setLookupMsg({ field: "cnpj", text: "Dados preenchidos a partir da Receita Federal" });
      }
    } catch (e: any) {
      setLookupMsg({ field: "cnpj", text: e.response?.data?.error || "Não foi possível consultar o CNPJ", warn: true });
    } finally {
      setLookingUp(null);
    }
  }

  // CEP: ao trocar o CEP, o endereço passa a ser o do novo CEP.
  async function lookupCep() {
    const cep = digitsOf(getValues("zip_code"));
    if (getValues("country_code") !== "BR" || cep.length !== 8 || cep === lastCep.current) return;
    setLookingUp("cep");
    setLookupMsg(null);
    try {
      const { data } = await api.get(`/api/lookup/cep/${cep}`);
      lastCep.current = cep;
      for (const field of ["address", "district", "city", "state", "zip_code"] as const) {
        if (data[field]) setValue(field, data[field], { shouldDirty: true });
      }
    } catch (e: any) {
      setLookupMsg({ field: "cep", text: e.response?.data?.error || "Não foi possível consultar o CEP", warn: true });
    } finally {
      setLookingUp(null);
    }
  }

  async function onSubmit(data: ClientForm) {
    setIsSaving(true);
    setError("");
    try {
      if (isEditing) {
        await api.patch(`/api/clients/${id}`, data);
      } else {
        await api.post("/api/clients", data);
      }
      navigate("/clients");
    } catch (e: any) {
      setError(e.response?.data?.error || "Erro ao salvar cliente");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        title={isEditing ? "Editar Cliente" : "Novo Cliente"}
        description={isEditing ? "Altere os dados do cliente" : "Preencha os dados para cadastrar um novo cliente"}
        action={
          <Button variant="outline" onClick={() => navigate("/clients")}>
            <ArrowLeft className="mr-2 h-4 w-4" />Voltar
          </Button>
        }
      />

      <div className="flex-1 p-6 max-w-3xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Dados principais */}
          <Card>
            <CardHeader><CardTitle className="text-base">Dados Principais</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo *</Label>
                  <Controller name="kind" control={control} rules={{ required: true }} render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PJ">Pessoa Jurídica</SelectItem>
                        <SelectItem value="PF">Pessoa Física</SelectItem>
                      </SelectContent>
                    </Select>
                  )} />
                </div>
                <div className="space-y-2">
                  <Label>Situação</Label>
                  <Controller name="situation" control={control} render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Ativo</SelectItem>
                        <SelectItem value="inactive">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                  )} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Nome / Razão Social *</Label>
                <Input {...register("name", { required: true })} className={errors.name ? "border-destructive" : ""} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Apelido *</Label>
                  <Input {...register("nickname", { required: true })} className={errors.nickname ? "border-destructive" : ""} />
                </div>
                <div className="space-y-2">
                  <Label>CPF / CNPJ *</Label>
                  <div className="relative">
                    <Input {...register("cnpj_cpf", { required: true, onBlur: lookupCnpj })} placeholder="000.000.000-00" className={errors.cnpj_cpf ? "border-destructive" : ""} />
                    {lookingUp === "cnpj" && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
                  </div>
                  <LookupHint msg={lookupMsg} field="cnpj" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Insc. Estadual</Label>
                  <Input {...register("ins_est")} />
                </div>
                <div className="space-y-2">
                  <Label>Insc. Municipal</Label>
                  <Input {...register("ins_mun")} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input {...register("telephone")} placeholder="(00) 0000-0000" />
                </div>
                <div className="space-y-2">
                  <Label>Celular</Label>
                  <Input {...register("cellphone")} placeholder="(00) 9 0000-0000" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Endereço */}
          <Card>
            <CardHeader><CardTitle className="text-base">Endereço</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label>Logradouro</Label>
                  <Input {...register("address")} />
                </div>
                <div className="space-y-2">
                  <Label>Número</Label>
                  <Input {...register("number")} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Complemento</Label>
                  <Input {...register("complement")} />
                </div>
                <div className="space-y-2">
                  <Label>Bairro</Label>
                  <Input {...register("district")} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1 space-y-2">
                  <Label>CEP</Label>
                  <div className="relative">
                    <Input {...register("zip_code", { onBlur: lookupCep })} placeholder="00000-000" />
                    {lookingUp === "cep" && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
                  </div>
                  <LookupHint msg={lookupMsg} field="cep" />
                </div>
                <div className="col-span-1 space-y-2">
                  <Label>Cidade</Label>
                  <Input {...register("city")} />
                </div>
                <div className="space-y-2">
                  <Label>UF</Label>
                  <Input {...register("state")} maxLength={2} placeholder="SP" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label>País</Label>
                  <Input
                    list="countries-list" placeholder="Brasil" autoComplete="off"
                    {...register("country", {
                      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                        const code = countryCodeFor(e.target.value);
                        if (code) setValue("country_code", code, { shouldDirty: true });
                      },
                    })}
                  />
                  <datalist id="countries-list">{COUNTRIES.map((c) => <option key={c.code} value={c.name} />)}</datalist>
                </div>
                <div className="space-y-2">
                  <Label>Código (ISO)</Label>
                  <Input
                    maxLength={2} placeholder="BR" className="uppercase"
                    {...register("country_code", { required: true, pattern: /^[A-Za-z]{2}$/, setValueAs: (v: string) => (v ?? "").toUpperCase() })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}

          <div className="flex gap-3">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : isEditing ? "Salvar Alterações" : "Cadastrar Cliente"}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate("/clients")}>Cancelar</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

const digitsOf = (v?: string | null) => (v || "").replace(/\D/g, "");

function LookupHint({ msg, field }: { msg: { field: string; text: string; warn?: boolean } | null; field: string }) {
  if (!msg || msg.field !== field) return null;
  return (
    <p className={`flex items-center gap-1 text-xs ${msg.warn ? "text-amber-600" : "text-muted-foreground"}`}>
      {msg.warn && <AlertTriangle className="h-3 w-3" />}{msg.text}
    </p>
  );
}
