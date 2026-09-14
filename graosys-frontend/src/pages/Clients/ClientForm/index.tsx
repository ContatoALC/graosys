import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { ArrowLeft, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { api } from "@/services/api";

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
  ins_est: string;
  ins_mun: string;
}

export function ClientFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(id);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<ClientForm>({
    defaultValues: { kind: "PJ", situation: "active" },
  });

  useEffect(() => {
    if (isEditing) {
      api.get(`/api/clients/${id}`).then((r) => reset(r.data)).catch(console.error);
    }
  }, [id]);

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
                  <Input {...register("cnpj_cpf", { required: true })} placeholder="000.000.000-00" className={errors.cnpj_cpf ? "border-destructive" : ""} />
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
                  <Input {...register("zip_code")} placeholder="00000-000" />
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
