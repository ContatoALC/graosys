import { test, expect } from "../support/fixtures";
import { adminApi, post, uid } from "../support/api";

// "Nº Corretor/Broker" do contrato: lista dos brokers cadastrados (pelo código); o escolhido entra no quadro
// de comissão, e o usuário que é broker já encontra o contrato novo preenchido com ele.
test.describe("Nº Corretor/Broker", () => {
  test("broker logado vem preenchido; trocar o broker troca no quadro de comissão", async ({ browser }, testInfo) => {
    test.setTimeout(30_000);
    const id = uid();
    const email = `e2e.broker.${id}@graosys.test`;
    const password = "Senha-E2E-123";
    const api = await adminApi();
    const user = await post(api, "/api/users", {
      name: `Broker Login ${id}`, email, password, role: "user",
      permissions: { contracts: ["view", "create", "edit"] },
    });
    await post(api, "/api/brokers", { name: `Meu Broker ${id}`, code: `M${id}`, user_id: user.id });
    await post(api, "/api/brokers", { name: `Outro Broker ${id}`, code: `O${id}` });
    await post(api, "/api/brokers", { name: `Sem Código ${id}` });

    // Código repetido não entra
    expect((await api.post("/api/brokers", { data: { name: "Repetido", code: `m${id}` } })).status()).toBe(400);

    const ctx = await browser.newContext({ baseURL: testInfo.project.use.baseURL, storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    try {
      await page.goto("/login");
      await page.locator("#email").fill(email);
      await page.locator("#password").fill(password);
      await page.getByRole("button", { name: "Entrar" }).click();
      await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

      await page.goto("/contracts/new");
      const number = page.getByLabel("Nº Corretor/Broker *");
      await expect(number).toHaveValue(`M${id}`);
      await expect(page.locator('select[name="brokers.0.broker_id"] option:checked')).toHaveText(`M${id} · Meu Broker ${id}`);

      // Trocar o broker no topo substitui o do quadro (não duplica)
      await number.selectOption({ label: `O${id} · Outro Broker ${id}` });
      await expect(page.locator('select[name="brokers.0.broker_id"] option:checked')).toHaveText(`O${id} · Outro Broker ${id}`);
      await expect(page.locator('select[name^="brokers."][name$=".broker_id"]')).toHaveCount(1);
      // Sem campo nem texto de % no quadro; broker sem código aparece marcado
      await expect(page.locator('input[name$=".commission_percent"]')).toHaveCount(0);
      await expect(page.getByText(/^Tabela:/)).toHaveCount(0);
      // A explicação da tabela de comissão é só para o admin da corretora
      await expect(page.getByText(/Cada broker recebe o % da tabela/)).toHaveCount(0);
      await expect(number.locator("option", { hasText: `Sem Código ${id} (sem código)` })).toHaveCount(1);
    } finally {
      await ctx.close();
      await api.delete(`/api/users/${user.id}`);
    }
  });

  test("quem não é broker começa com o campo vazio", async ({ page }) => {
    await page.goto("/contracts/new");
    await expect(page.getByLabel("Nº Corretor/Broker *")).toHaveValue("");
    await expect(page.getByText("Nenhum broker neste contrato.")).toBeVisible();
    await expect(page.getByText(/Cada broker recebe o % da tabela/)).toBeVisible(); // admin vê a explicação
  });
});
