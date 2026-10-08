import { test, expect } from "../support/fixtures";
import { adminApi, contractPayload, post, uid } from "../support/api";

// Dados que alimentam os templates de contrato: vínculo das partes com o cadastro, conta de pagamento,
// numeração e memória de cálculo das fixações e endereço da corretora.
test.describe("Dados para templates de contrato", () => {
  test("vendedor do cadastro fica vinculado e oferece a conta de pagamento", async ({ page }) => {
    test.setTimeout(30_000); // cadastro de cliente + contrato + reabertura
    const id = uid();
    const client = `Cliente Banco ${id}`;
    const number = `TPL-${id}`;
    const api = await adminApi();
    await post(api, "/api/products", { product_type: `TPL${id}`, name: `Produto TPL ${id}` });

    // Cliente com conta bancária, pela tela
    await page.goto("/clients/new");
    await page.locator('input[name="name"]').fill(client);
    await page.locator('input[name="nickname"]').fill(`TPL${id}`);
    await page.locator('input[name="cnpj_cpf"]').fill(`111${id}`); // 11 dígitos: sem consulta de CNPJ
    await page.getByRole("button", { name: "Adicionar conta" }).click();
    await page.locator('input[name="account.0.bank"]').fill("Banco E2E");
    await page.locator('input[name="account.0.agency"]').fill("1234");
    await page.locator('input[name="account.0.account"]').fill(`${id}-0`);
    await page.getByRole("button", { name: "Cadastrar Cliente" }).click();
    await expect(page).toHaveURL(/\/clients$/);

    // Contrato: vendedor escolhido da lista, comprador digitado
    await post(api, "/api/brokers", { name: `Broker ${id}`, code: `B${id}` });
    await page.goto("/contracts/new");
    await page.getByLabel("Nº Corretor/Broker *").selectOption({ label: `B${id} · Broker ${id}` });
    await page.locator('input[name="number_contract"]').fill(number);
    const account = page.getByLabel("Conta para pagamento");
    await expect(account).toBeDisabled();

    await page.getByPlaceholder("Buscar ou digitar o vendedor").fill(client);
    await page.getByRole("button", { name: new RegExp(client) }).click();
    await expect(page.getByTestId("seller-0")).toContainText("Vinculado ao cadastro");
    await page.getByPlaceholder("Buscar ou digitar o comprador").fill("Comprador sem cadastro");
    await expect(page.getByTestId("buyer-0")).not.toContainText("Vinculado ao cadastro");

    await expect(account).toBeEnabled();
    await account.selectOption({ label: `Banco E2E · Ag. 1234 · C/C ${id}-0` });

    await page.getByRole("combobox").filter({ hasText: "Selecione o produto" }).click();
    await page.getByRole("option", { name: `Produto TPL ${id}` }).click();
    await page.locator('input[name="crop"]').fill("2025/2026");
    await page.locator('input[name="quantity"]').fill("100");
    await page.locator('input[name="price"]').fill("50");
    await page.getByRole("button", { name: "Registrar Contrato" }).click();
    await expect(page).toHaveURL(/\/contracts$/);

    // A API gravou o vínculo só para a parte cadastrada, e a conta escolhida
    const list = await (await api.get(`/api/contracts?search=${number}`)).json();
    const saved = list.data[0];
    expect(saved.seller_ids).toHaveLength(1);
    expect(saved.seller_ids[0]).toBeTruthy();
    expect(saved.buyer_ids).toEqual([null]);
    expect(saved.payment_account).toMatchObject({ bank: "Banco E2E", agency: "1234", account: `${id}-0` });

    // Reabrir mantém o vínculo e a conta; voltar a digitar o nome desfaz o vínculo
    await page.goto(`/contracts/${saved.id}`);
    await expect(page.getByTestId("seller-0")).toContainText("Vinculado ao cadastro");
    await expect(page.getByLabel("Conta para pagamento").locator("option:checked")).toHaveText(`Banco E2E · Ag. 1234 · C/C ${id}-0`);
    await page.getByPlaceholder("Buscar ou digitar o vendedor").fill("Outro vendedor digitado");
    await expect(page.getByTestId("seller-0")).not.toContainText("Vinculado ao cadastro");
    await page.getByRole("button", { name: "Salvar Alterações" }).click();
    await expect(page).toHaveURL(/\/contracts$/);
    const after = await (await api.get(`/api/contracts/${saved.id}`)).json();
    expect(after.seller).toEqual(["Outro vendedor digitado"]);
    expect(after.seller_ids).toEqual([null]);
    await api.dispose();
  });

  test("a API não aceita vínculo com cliente de nome diferente", async () => {
    const id = uid();
    const api = await adminApi();
    const client = await post(api, "/api/clients", { name: `Cliente Real ${id}`, nickname: `CR${id}`, kind: "PF", cnpj_cpf: `222${id}` });
    const contract = await post(api, "/api/contracts", contractPayload(`LNK-${id}`, {
      seller: [`Cliente Real ${id}`, "Nome que não é do cadastro"], seller_ids: [client.id, client.id],
      buyer: ["Comprador E2E"], buyer_ids: ["id-inexistente"],
    }));
    expect(contract.seller_ids).toEqual([client.id, null]);
    expect(contract.buyer_ids).toEqual([null]);
    await api.dispose();
  });

  test("fixação Frame numera (F01, F02) e grava a memória de cálculo", async ({ page }) => {
    test.setTimeout(20_000); // duas fixações pela tela
    const number = `FIX-${uid()}`;
    const api = await adminApi();
    const contract = await post(api, "/api/contracts", contractPayload(number, {
      price_type: "to_fix", fixation_mode: "frame", fixation_deadline: "2099-12-31", cbot_reference: "SX99", price: undefined,
    }));

    await page.goto("/contracts");
    await page.getByPlaceholder("Buscar por nº contrato...").fill(number);
    await page.getByRole("button", { name: "Buscar" }).click();
    await page.getByRole("row", { name: new RegExp(number) }).getByTitle("Fixações de preço").click();

    const fill = async (values: Record<string, string>) => {
      await page.getByRole("button", { name: "Nova fixação" }).click();
      const dialog = page.getByRole("dialog", { name: "Nova fixação" });
      await dialog.getByText("Quantidade (sc)").locator("..").locator("input").fill(values.quantity);
      await dialog.getByText("Chicago (c/bu)").locator("..").locator("input").fill("1000");
      await dialog.getByText("Prêmio (c/bu)").locator("..").locator("input").fill("50");
      await dialog.getByText("Câmbio (R$/US$)").locator("..").locator("input").fill("5");
      if (values.factor) await dialog.getByLabel("Fator de conversão (bu/t)").fill(values.factor);
      if (values.fobbings) await dialog.getByLabel("Fobbings (US$/t)").fill(values.fobbings);
      return dialog;
    };

    // Fobbings maiores que Chicago + prêmio: o servidor recusa
    let dialog = await fill({ quantity: "400", factor: "36", fobbings: "9999" });
    await dialog.getByRole("button", { name: "Lançar fixação" }).click();
    await expect(dialog.getByText("Os fobbings não podem ser maiores")).toBeVisible();
    await dialog.getByRole("button", { name: "Cancelar" }).click();

    // (1000 + 50) / 100 × 36 − 10 = US$ 368/t → × 0,06 t/sc × 5 = R$ 110,40/sc
    dialog = await fill({ quantity: "400", factor: "36", fobbings: "10" });
    await expect(dialog.getByTestId("ppe-preview")).toContainText("$368.00");
    await dialog.getByRole("button", { name: "Lançar fixação" }).click();
    await expect(page.getByRole("row", { name: /F01/ })).toContainText("110,40");

    // Sem fator nem fobbings vale o padrão do produto (soja: 36,7437 bu/t)
    dialog = await fill({ quantity: "100" });
    await dialog.getByRole("button", { name: "Lançar fixação" }).click();
    await expect(page.getByRole("row", { name: /F02/ })).toBeVisible();

    const { fixations } = await (await api.get(`/api/contracts/${contract.id}/fixations`)).json();
    expect(fixations.map((f: any) => f.sequence)).toEqual([1, 2]);
    expect(Number(fixations[0].ppe)).toBe(368);
    expect(Number(fixations[0].fobbings)).toBe(10);
    expect(Number(fixations[0].conversion_factor)).toBe(36);
    expect(Number(fixations[0].price)).toBe(110.4);
    expect(Number(fixations[1].conversion_factor)).toBeCloseTo(36.7437, 3);
    expect(Number(fixations[1].ppe)).toBeCloseTo(385.81, 1);
    await api.dispose();
  });

  test("endereço da corretora é salvo no Layout do PDF", async ({ page }) => {
    const city = `Cidade ${uid()}`;
    await page.goto("/admin/pdf-layout");
    await expect(page.getByLabel("Cidade")).toBeEditable();
    await page.getByLabel("Logradouro").fill("Rua dos Testes");
    await page.getByLabel("Cidade").fill(city);
    await page.getByLabel("UF").fill("PR");
    await page.getByRole("button", { name: "Salvar endereço" }).click();
    await expect(page.getByText("Endereço salvo")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Cidade")).toHaveValue(city);
    await expect(page.getByLabel("UF")).toHaveValue("PR");
  });
});
