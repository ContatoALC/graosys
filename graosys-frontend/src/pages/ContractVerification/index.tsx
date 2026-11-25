import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Wheat, Loader2, ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/services/api";
import { formatDate } from "@/lib/utils";

interface VerifiedContract {
  broker: { name: string; cnpj: string | null };
  number_contract: string;
  product: string;
  crop: string;
  contract_emission_date: string | null;
  cancelled: boolean;
}

// Página pública aberta pelo QR code do PDF: selo de autenticidade (existe, de qual corretora, se foi cancelado),
// sem partes, volume nem preço.
export function ContractVerificationPage() {
  const { id } = useParams();
  const [contract, setContract] = useState<VerifiedContract | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    // Página pública aberta por link: fora dos buscadores.
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex, nofollow";
    document.head.appendChild(robots);
    return () => robots.remove();
  }, []);

  useEffect(() => {
    api.get(`/api/public/contracts/${id}/verify`)
      .then(({ data }) => setContract(data))
      .catch((e) => setError(e.response?.status === 404 ? "not_found" : e.response?.status === 429 ? "throttled" : "error"));
  }, [id]);

  const rows: [string, string][] = contract
    ? [
        ["Corretora", contract.broker.cnpj ? `${contract.broker.name} · CNPJ ${contract.broker.cnpj}` : contract.broker.name],
        ["Nº do contrato", contract.number_contract],
        ["Produto", [contract.product, contract.crop].filter(Boolean).join(" · Safra ")],
        ["Emissão", contract.contract_emission_date ? formatDate(contract.contract_emission_date) : "—"],
      ]
    : [];

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-grain-50 to-grain-100 py-8">
      <div className="w-full max-w-lg px-4">
        <div className="mb-6 flex flex-col items-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary shadow-lg">
            <Wheat className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="mt-3 text-2xl font-bold text-gray-900">Verificação de contrato</h1>
        </div>
        <Card className="shadow-xl">
          {!contract && !error && (
            <CardContent className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></CardContent>
          )}
          {error && (
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive"><ShieldX className="h-5 w-5" />{error === "not_found" ? "Contrato não encontrado" : "Consulta indisponível"}</CardTitle>
              <CardDescription>
                {error === "not_found"
                  ? "Este código não corresponde a nenhum contrato registrado no GraoSys. Desconfie do documento e fale com a corretora."
                  : error === "throttled"
                    ? "Muitas consultas seguidas. Aguarde um minuto e tente novamente."
                    : "Não foi possível consultar o contrato agora. Tente novamente em instantes."}
              </CardDescription>
            </CardHeader>
          )}
          {contract && (
            <>
              <CardHeader>
                {contract.cancelled ? (
                  <CardTitle className="flex items-center gap-2 text-destructive"><ShieldAlert className="h-5 w-5" />Contrato cancelado</CardTitle>
                ) : (
                  <CardTitle className="flex items-center gap-2 text-green-700"><ShieldCheck className="h-5 w-5" />Contrato autêntico</CardTitle>
                )}
                <CardDescription>
                  {contract.cancelled
                    ? "Este contrato foi registrado pela corretora abaixo, mas está cancelado e não tem mais validade."
                    : "Este contrato foi registrado pela corretora abaixo e está válido."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="divide-y text-sm">
                  {rows.map(([label, value]) => (
                    <div key={label} className="grid grid-cols-3 gap-2 py-2">
                      <dt className="font-medium text-muted-foreground">{label}</dt>
                      <dd className="col-span-2 break-words">{value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-4 text-xs text-muted-foreground">
                  Esta página confirma a origem e a situação do contrato, não os valores. Em caso de dúvida sobre partes,
                  quantidade ou preço, fale com a corretora. Confira se o endereço desta página é {window.location.host}.
                </p>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
