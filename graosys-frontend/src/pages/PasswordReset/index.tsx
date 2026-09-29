import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { Wheat, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/services/api";

function AuthShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-grain-50 to-grain-100">
      <div className="w-full max-w-md px-4">
        <div className="mb-8 flex flex-col items-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg">
            <Wheat className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="mt-4 text-3xl font-bold text-gray-900">GraoSys</h1>
        </div>
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {children}
            <Link to="/login" className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3 w-3" />Voltar para o login
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function ForgotPasswordPage() {
  const [sent, setSent] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { register, handleSubmit } = useForm<{ email: string }>();

  async function onSubmit({ email }: { email: string }) {
    setIsLoading(true);
    setError("");
    try {
      const { data } = await api.post("/api/auth/forgot-password", { email });
      setSent(data.message);
    } catch (e: any) {
      setError(e.response?.data?.error || "Não foi possível enviar o pedido. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthShell title="Esqueci minha senha" description="Informe o seu e-mail para receber um link de redefinição">
      {sent ? (
        <p className="rounded-md bg-primary/10 px-3 py-2 text-sm">{sent} Confira também a caixa de spam.</p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" placeholder="seu@email.com.br" {...register("email", { required: true })} />
          </div>
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enviando...</> : "Enviar link"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { register, handleSubmit } = useForm<{ password: string; confirm: string }>();

  async function onSubmit({ password, confirm }: { password: string; confirm: string }) {
    if (password !== confirm) return setError("As senhas não conferem.");
    setIsLoading(true);
    setError("");
    try {
      const { data } = await api.post("/api/auth/reset-password-token", { token, new_password: password });
      setDone(data.message);
      setTimeout(() => navigate("/login"), 2500);
    } catch (e: any) {
      setError(e.response?.data?.error || "Não foi possível redefinir a senha.");
    } finally {
      setIsLoading(false);
    }
  }

  if (!token) {
    return (
      <AuthShell title="Link inválido" description="Este link de redefinição está incompleto.">
        <Button asChild className="w-full"><Link to="/forgot-password">Pedir um novo link</Link></Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Criar nova senha" description="Escolha uma senha com no mínimo 8 caracteres">
      {done ? (
        <p className="rounded-md bg-primary/10 px-3 py-2 text-sm">{done}</p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Nova senha</Label>
            <Input id="password" type="password" autoComplete="new-password" {...register("password", { required: true, minLength: 8 })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirme a nova senha</Label>
            <Input id="confirm" type="password" autoComplete="new-password" {...register("confirm", { required: true })} />
          </div>
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : "Salvar nova senha"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
