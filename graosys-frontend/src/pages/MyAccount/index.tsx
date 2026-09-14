import { useState } from "react";
import { User, Lock } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/services/api";
import { useForm } from "react-hook-form";

export function MyAccountPage() {
  const { user } = useAuth();
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const { register, handleSubmit, reset } = useForm<{ current_password: string; new_password: string; confirm_password: string }>();

  async function onSubmit(data: { current_password: string; new_password: string; confirm_password: string }) {
    if (data.new_password !== data.confirm_password) {
      setError("As senhas não coincidem"); return;
    }
    setError(""); setSuccess("");
    try {
      await api.post("/api/auth/reset-password", { current_password: data.current_password, new_password: data.new_password });
      setSuccess("Senha alterada com sucesso!");
      reset();
    } catch (e: any) {
      setError(e.response?.data?.error || "Erro ao alterar senha");
    }
  }

  return (
    <div className="flex flex-col">
      <PageHeader title="Minha Conta" description="Informações e configurações da sua conta" />
      <div className="flex-1 space-y-6 p-6 max-w-lg">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><User className="h-4 w-4" />Dados da Conta</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label className="text-muted-foreground">Nome</Label>
              <p className="font-medium">{user?.name}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground">E-mail</Label>
              <p className="font-medium">{user?.email}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground">Corretora</Label>
              <p className="font-medium">{user?.tenant_name}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground">Perfil</Label>
              <p className="font-medium capitalize">{user?.role === "admin" ? "Administrador" : "Usuário"}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Lock className="h-4 w-4" />Alterar Senha</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2"><Label>Senha Atual</Label><Input type="password" {...register("current_password", { required: true })} /></div>
              <div className="space-y-2"><Label>Nova Senha</Label><Input type="password" {...register("new_password", { required: true, minLength: 6 })} /></div>
              <div className="space-y-2"><Label>Confirmar Nova Senha</Label><Input type="password" {...register("confirm_password", { required: true })} /></div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              {success && <p className="text-sm text-green-600">{success}</p>}
              <Button type="submit">Alterar Senha</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
