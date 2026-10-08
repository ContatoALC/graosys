import { test, expect } from "../support/fixtures";
import { adminApi, contractPayload, post, uid, userApi } from "../support/api";
import type { APIRequestContext } from "@playwright/test";

// Fluxo do contrato por departamento (linha de montagem): o contrato só passa adiante pelas ações,
// cada etapa pertence a um departamento e só quem trabalha nele move o contrato.
// Serial: o teste do fluxo simplificado muda a configuração da corretora.
test.describe.configure({ mode: "serial" });

const stageOf = async (api: APIRequestContext, id: string) => (await (await api.get(`/api/contracts/${id}`)).json()).status.status_current;
const act = (api: APIRequestContext, id: string, action: string, reason?: string) =>
  api.post(`/api/contracts/${id}/workflow`, { data: { action, reason } });

test.describe("Fluxo do contrato por departamento", () => {
  test("Contratos → Execução, com devolução, aprovação, cancelamento e reabertura", async () => {
    const api = await adminApi();
    const contract = await post(api, "/api/contracts", contractPayload(`FLX-${uid()}`, { list_email_seller: ["vendedor@fluxo.test"] }));
    expect(contract.status.status_current).toBe("Em Elaboração");
    expect((await (await api.get("/api/contracts?department=contracts&limit=500")).json()).data.map((c: any) => c.id)).toContain(contract.id);

    // Sem aprovação da Execução o contrato não sai para o cliente, e não se pula etapa
    const send = await api.post("/api/email/send-contract", { data: { contract_id: contract.id } });
    expect(send.status()).toBe(409);
    expect((await send.json()).error).toContain("aprovado pela Execução");
    expect((await act(api, contract.id, "approve")).status()).toBe(409);

    expect((await act(api, contract.id, "submit")).status()).toBe(200);
    expect(await stageOf(api, contract.id)).toBe("Em Análise");

    // Devolver exige motivo, que fica no histórico
    expect((await act(api, contract.id, "return")).status()).toBe(400);
    expect((await act(api, contract.id, "return", "Preço divergente da proposta")).status()).toBe(200);
    const returned = await (await api.get(`/api/contracts/${contract.id}`)).json();
    expect(returned.status.status_current).toBe("Devolvido");
    expect(returned.status.history.at(-1)).toMatchObject({ action: "return", reason: "Preço divergente da proposta" });

    expect((await act(api, contract.id, "submit")).status()).toBe(200);
    expect((await act(api, contract.id, "approve")).status()).toBe(200);
    expect(await stageOf(api, contract.id)).toBe("Aguardando Envio");

    // Cancelar exige motivo; contrato cancelado não é enviado; o admin reabre
    expect((await act(api, contract.id, "cancel")).status()).toBe(400);
    expect((await act(api, contract.id, "cancel", "Negócio desfeito")).status()).toBe(200);
    expect(await stageOf(api, contract.id)).toBe("Cancelado");
    expect((await (await api.post("/api/email/send-contract", { data: { contract_id: contract.id } })).json()).error).toContain("cancelado");
    expect((await act(api, contract.id, "reopen", "Cancelado por engano")).status()).toBe(200);
    expect(await stageOf(api, contract.id)).toBe("Em Elaboração");

    expect((await act(api, contract.id, "inventada")).status()).toBe(400);
    expect((await api.get("/api/contracts?department=inventado")).status()).toBe(400);
  });

  test("só quem trabalha no departamento da etapa move o contrato", async () => {
    const id = uid();
    const email = `e2e.fluxo.${id}@graosys.test`;
    const password = "Senha-E2E-123";
    const admin = await adminApi();
    await post(admin, "/api/users", {
      name: `Operador Contratos ${id}`, email, password, role: "user",
      permissions: { contracts: ["view", "create", "edit"], execution: ["view"] },
    });
    const operator = await userApi(email, password);
    const contract = await post(operator, "/api/contracts", contractPayload(`FLX-${id}`));

    expect((await act(operator, contract.id, "submit")).status()).toBe(200);
    // Em Análise é da Execução: o operador de Contratos não aprova nem cancela
    expect((await act(operator, contract.id, "approve")).status()).toBe(403);
    expect((await act(operator, contract.id, "cancel", "Tentativa")).status()).toBe(403);
    expect((await act(admin, contract.id, "approve")).status()).toBe(200);
    // Reabrir é só do admin
    expect((await act(admin, contract.id, "cancel", "Teste")).status()).toBe(200);
    expect((await act(operator, contract.id, "reopen", "Tentativa")).status()).toBe(403);
  });

  test("fluxo simplificado: o contrato nasce pronto para envio", async () => {
    const api = await adminApi();
    expect((await api.patch("/api/tenant", { data: { workflow_mode: "qualquer" } })).status()).toBe(400);
    expect((await api.patch("/api/tenant", { data: { workflow_mode: "simple" } })).status()).toBe(200);
    try {
      const contract = await post(api, "/api/contracts", contractPayload(`FLX-${uid()}`));
      expect(contract.status.status_current).toBe("Aguardando Envio");
      expect(contract.status.history[0].reason).toContain("análise dispensada");

      // Devolvido volta direto para envio, sem passar pela análise
      expect((await act(api, contract.id, "return", "Ajustar quantidade")).status()).toBe(200);
      expect((await act(api, contract.id, "submit")).status()).toBe(200);
      expect(await stageOf(api, contract.id)).toBe("Aguardando Envio");
    } finally {
      await api.patch("/api/tenant", { data: { workflow_mode: "full" } });
    }
  });
});
