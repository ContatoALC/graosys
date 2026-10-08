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

test.describe("Fluxo do contrato nas telas", () => {
  test("Contratos envia, Execução devolve com motivo, Contratos corrige e a Execução aprova", async ({ page }) => {
    test.setTimeout(40_000); // passa pelas duas filas duas vezes
    const number = `FLX-${uid()}`;
    const api = await adminApi();
    const contract = await post(api, "/api/contracts", contractPayload(number));

    const rowIn = async (path: string, placeholder: string) => {
      await page.goto(path);
      await page.getByPlaceholder(placeholder).fill(number);
      await page.getByPlaceholder(placeholder).press("Enter");
      return page.getByRole("row", { name: new RegExp(number) });
    };

    // Fila de Contratos: o selo diz o departamento; o próximo passo é enviar para a Execução
    let row = await rowIn("/contracts", "Buscar por nº contrato...");
    await expect(row.getByTestId("contract-stage")).toHaveText(/Contratos\s*· Em Elaboração/);
    await row.getByRole("button", { name: "Enviar para Execução" }).click();
    await expect(row.getByTestId("contract-stage")).toHaveText(/Execução\s*· Em Análise/);

    // Fila da Execução: devolver pede o motivo
    row = await rowIn("/execution", "Buscar contrato...");
    await row.getByRole("button", { name: "Devolver" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "Confirmar" })).toBeDisabled();
    await dialog.getByLabel("O que precisa ser corrigido em Contratos?").fill("Quantidade divergente");
    await dialog.getByRole("button", { name: "Confirmar" }).click();
    await expect(row.getByTestId("contract-stage")).toHaveText(/Contratos\s*· Devolvido/);

    // De volta à fila de Contratos, com o motivo à vista
    row = await rowIn("/contracts", "Buscar por nº contrato...");
    await expect(row).toContainText("Motivo: Quantidade divergente");
    await row.getByRole("button", { name: "Enviar para Execução" }).click();
    await expect(row.getByTestId("contract-stage")).toHaveText(/Em Análise/);

    // Execução aprova: o próximo passo vira enviar ao cliente
    row = await rowIn("/execution", "Buscar contrato...");
    await row.getByRole("button", { name: "Aprovar" }).click();
    await expect(row.getByTestId("contract-stage")).toHaveText(/Execução\s*· Aguardando Envio/);
    await expect(row.getByRole("button", { name: "Enviar ao cliente" })).toBeVisible();

    // Página do contrato: histórico com quem passou adiante e por quê; cancelar pede motivo
    await page.goto(`/contracts/${contract.id}`);
    const timeline = page.getByTestId("contract-timeline");
    await expect(timeline).toContainText("Devolvido para Contratos");
    await expect(timeline).toContainText("Quantidade divergente");
    await expect(timeline).toContainText("Aprovado pela Execução");
    await page.getByRole("button", { name: "Cancelar contrato" }).click();
    await page.getByRole("dialog").getByLabel("Por que o contrato está sendo cancelado?").fill("Negócio desfeito");
    await page.getByRole("dialog").getByRole("button", { name: "Confirmar" }).click();
    await expect(page.getByTestId("contract-stage").first()).toHaveText(/Cancelado/);
    await expect(timeline).toContainText("Negócio desfeito");
  });

  test("pós-venda: a marcação fica no contrato e aparece na fila da Execução", async ({ page }) => {
    const number = `FLX-${uid()}`;
    const api = await adminApi();
    const contract = await post(api, "/api/contracts", contractPayload(number));
    expect(contract.track_shipment).toBe(false);

    await page.goto(`/contracts/${contract.id}`);
    const track = page.getByLabel("Acompanhar embarque (pós-venda)");
    await expect(track).not.toBeChecked();
    await track.check();
    await page.getByRole("button", { name: "Salvar Alterações" }).click();
    await expect(page).toHaveURL(/\/contracts$/);
    expect((await (await api.get(`/api/contracts/${contract.id}`)).json()).track_shipment).toBe(true);

    await post(api, `/api/contracts/${contract.id}/workflow`, { action: "submit" });
    await page.goto("/execution");
    await page.getByPlaceholder("Buscar contrato...").fill(number);
    await page.getByPlaceholder("Buscar contrato...").press("Enter");
    await expect(page.getByRole("row", { name: new RegExp(number) })).toContainText("Pós-venda");
  });

  test("novo contrato: registrar e enviar para a Execução; no fluxo simplificado o botão some", async ({ page }) => {
    test.setTimeout(40_000);
    const id = uid();
    const number = `FLX-${id}`;
    const api = await adminApi();
    await post(api, "/api/products", { product_type: `FLX${id}`, name: `Produto FLX ${id}` });

    await post(api, "/api/brokers", { name: `Broker ${id}`, code: `B${id}` });
    await page.goto("/contracts/new");
    await page.getByLabel("Nº Corretor/Broker *").selectOption({ label: `B${id} · Broker ${id}` });
    await page.locator('input[name="number_contract"]').fill(number);
    await page.getByPlaceholder("Buscar ou digitar o vendedor").fill("Vendedor Fluxo");
    await page.getByPlaceholder("Buscar ou digitar o comprador").fill("Comprador Fluxo");
    await page.getByRole("combobox").filter({ hasText: "Selecione o produto" }).click();
    await page.getByRole("option", { name: `Produto FLX ${id}` }).click();
    await page.locator('input[name="crop"]').fill("2025/2026");
    await page.locator('input[name="quantity"]').fill("100");
    await page.locator('input[name="price"]').fill("50");
    await page.getByRole("button", { name: "Registrar e enviar para Execução" }).click();
    await expect(page).toHaveURL(/\/contracts$/);

    const saved = (await (await api.get(`/api/contracts?search=${number}`)).json()).data[0];
    expect(saved.status.status_current).toBe("Em Análise");

    // Admin escolhe o fluxo simplificado: o contrato novo já nasce pronto para envio
    await page.goto("/admin");
    await page.getByRole("radio", { name: /Fluxo simplificado/ }).click();
    await expect(page.getByRole("radio", { name: /Fluxo simplificado/ })).toHaveAttribute("aria-checked", "true");
    try {
      await page.goto("/contracts/new");
      await expect(page.getByRole("button", { name: "Registrar Contrato" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Registrar e enviar para Execução" })).toHaveCount(0);
    } finally {
      await api.patch("/api/tenant", { data: { workflow_mode: "full" } });
    }
  });
});
