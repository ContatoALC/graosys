import https from "https";

// Consulta de CNPJ e CEP na BrasilAPI (gratuita, sem chave). A URL base é configurável em
// BRASILAPI_URL (outro provedor compatível, mock em testes ou espelho próprio).
const BASE_URL = (process.env.BRASILAPI_URL || "https://brasilapi.com.br/api").replace(/\/+$/, "");
const TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export class LookupNotFound extends Error {}
export class LookupUnavailable extends Error {}

export interface AddressLookup {
  address: string;
  district: string;
  city: string;
  state: string;
  zip_code: string;
}

export interface CompanyLookup extends Partial<AddressLookup> {
  name: string;
  nickname: string;
  number: string;
  complement: string;
  telephone: string;
  registration_status: string; // situação cadastral na Receita (ATIVA, BAIXADA, INAPTA...)
}

// Cache por instância: evita repetir consultas do mesmo documento durante o cadastro.
const cache = new Map<string, { expires: number; value: unknown }>();

function getJson(path: string): Promise<any> {
  const url = `${BASE_URL}${path}`;
  const hit = cache.get(url);
  if (hit && hit.expires > Date.now()) return Promise.resolve(hit.value);

  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { Accept: "application/json", "User-Agent": "graosys" }, timeout: TIMEOUT_MS }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        const status = res.statusCode || 0;
        if (status === 404 || status === 400) return reject(new LookupNotFound());
        if (status < 200 || status >= 300) return reject(new LookupUnavailable(`BrasilAPI ${status} em ${path}`));
        try {
          const value = JSON.parse(body);
          cache.set(url, { expires: Date.now() + CACHE_TTL_MS, value });
          resolve(value);
        } catch {
          reject(new LookupUnavailable(`Resposta inválida da BrasilAPI em ${path}`));
        }
      });
    });
    req.on("timeout", () => req.destroy(new LookupUnavailable(`Tempo esgotado na BrasilAPI em ${path}`)));
    req.on("error", (err) => reject(err instanceof LookupUnavailable ? err : new LookupUnavailable(err.message)));
  });
}

const digits = (v: string) => (v || "").replace(/\D/g, "");
const formatCep = (cep: string) => (cep.length === 8 ? `${cep.slice(0, 5)}-${cep.slice(5)}` : cep);

function formatPhone(ddd: string): string {
  const d = digits(ddd);
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`;
  return d;
}

export async function lookupCep(cep: string): Promise<AddressLookup> {
  const clean = digits(cep);
  if (clean.length !== 8) throw new LookupNotFound();
  const data = await getJson(`/cep/v1/${clean}`);
  return {
    address: data.street || "",
    district: data.neighborhood || "",
    city: data.city || "",
    state: data.state || "",
    zip_code: formatCep(digits(data.cep) || clean),
  };
}

export async function lookupCnpj(cnpj: string): Promise<CompanyLookup> {
  const clean = digits(cnpj);
  if (clean.length !== 14) throw new LookupNotFound();
  const data = await getJson(`/cnpj/v1/${clean}`);
  const street = [data.descricao_tipo_de_logradouro, data.logradouro].filter(Boolean).join(" ");
  return {
    name: data.razao_social || "",
    nickname: data.nome_fantasia || "",
    address: street,
    number: data.numero || "",
    complement: data.complemento || "",
    district: data.bairro || "",
    city: data.municipio || "",
    state: data.uf || "",
    zip_code: formatCep(digits(data.cep)),
    telephone: formatPhone(data.ddd_telefone_1 || ""),
    registration_status: data.descricao_situacao_cadastral || "",
  };
}
