import { readFileSync } from "node:fs";
import { request, expect, type APIRequestContext } from "@playwright/test";

/**
 * Acesso direto à API para montar dados de teste sem passar pelas telas.
 * Use só para o que NÃO é o foco do spec (o fluxo testado deve ser feito pela UI).
 */
export const API_URL = process.env.API_URL ?? "http://localhost:3333";
const AUTH_FILE = "playwright/.auth/superadmin.json";

function storedToken(): string {
  const state = JSON.parse(readFileSync(AUTH_FILE, "utf8"));
  const entry = state.origins.flatMap((o: any) => o.localStorage).find((e: any) => e.name === "@graosys:token");
  if (!entry) throw new Error(`Token não encontrado em ${AUTH_FILE}. Rode o projeto "setup" antes.`);
  return entry.value;
}

/** API autenticada como o superadmin do setup. */
export function adminApi(): Promise<APIRequestContext> {
  return request.newContext({ baseURL: API_URL, extraHTTPHeaders: { Authorization: `Bearer ${storedToken()}` } });
}

/** API autenticada como outro usuário (login real). */
export async function userApi(email: string, password: string): Promise<APIRequestContext> {
  const anon = await request.newContext({ baseURL: API_URL });
  const res = await anon.post("/api/auth/login", { data: { email, password } });
  expect(res.ok(), `login de ${email}: ${res.status()}`).toBeTruthy();
  const { token } = await res.json();
  await anon.dispose();
  return request.newContext({ baseURL: API_URL, extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
}

/** POST que falha o teste com a mensagem da API em caso de erro. */
export async function post<T = any>(api: APIRequestContext, url: string, data: unknown): Promise<T> {
  const res = await api.post(url, { data });
  expect(res.ok(), `POST ${url}: ${res.status()} ${await res.text()}`).toBeTruthy();
  return res.json();
}

/** Sufixo único por execução (para rodar várias vezes no mesmo banco). */
export const uid = () => `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;

/**
 * Contrato simples: 1000 sc × R$ 100 = R$ 100.000, comissão do vendedor 1% → R$ 1.000 de comissão da corretora.
 */
export function contractPayload(number: string, extra: Record<string, unknown> = {}) {
  return {
    number_broker: `B-${number}`,
    number_contract: number,
    seller: ["Vendedor E2E"],
    buyer: ["Comprador E2E"],
    list_email_seller: [],
    list_email_buyer: [],
    product: "E2E",
    name_product: "Soja E2E",
    crop: "2025/2026",
    type_quantity: "sc",
    quantity: 1000,
    type_currency: "BRL",
    price_type: "fixed",
    price: 100,
    type_commission_seller: "%",
    commission_seller: "1",
    brokers: [],
    ...extra,
  };
}

/** Contrato que já passou por Contratos e pela análise da Execução (fica "Aguardando Envio"). */
export async function approvedContract(api: APIRequestContext, number: string, extra: Record<string, unknown> = {}) {
  let contract = await post(api, "/api/contracts", contractPayload(number, extra));
  // Outro spec pode ligar o fluxo simplificado por um instante: só avança o que faltar.
  if (contract.status.status_current === "Em Elaboração") contract = await post(api, `/api/contracts/${contract.id}/workflow`, { action: "submit" });
  if (contract.status.status_current === "Em Análise") contract = await post(api, `/api/contracts/${contract.id}/workflow`, { action: "approve" });
  return contract;
}
