import { test, expect } from "../support/fixtures";

test.describe("Contratos", () => {
  test("cria produto e broker, registra um contrato e edita", async ({ page }) => {
    test.setTimeout(30_000); // passa por 3 telas e 2 cadastros antes do contrato
    const suffix = Date.now().toString().slice(-6);
    const productName = `Produto E2E ${suffix}`;
    const brokerName = `Broker E2E ${suffix}`;
    const number = `E2E-${suffix}`;
    const client = `Cliente E2E ${suffix}`;

    // Cliente (usado como vendedor pelo ClientPicker)
    await page.goto("/clients/new");
    await page.locator('input[name="name"]').fill(client);
    await page.locator('input[name="nickname"]').fill(`E2E${suffix}`);
    await page.locator('input[name="cnpj_cpf"]').fill(`000${suffix}00`); // 11 dígitos: sem consulta de CNPJ
    await page.getByRole("button", { name: "Cadastrar Cliente" }).click();
    await expect(page).toHaveURL(/\/clients$/);

    // Produto
    await page.goto("/admin/products");
    await page.getByRole("button", { name: "Novo Produto" }).click();
    const productDialog = page.getByRole("dialog");
    await productDialog.locator('input[name="product_type"]').fill(`E2E${suffix}`);
    await productDialog.locator('input[name="name"]').fill(productName);
    await productDialog.locator('input[name="quality"]').fill("Padrão exportação");
    await productDialog.getByRole("button", { name: "Criar" }).click();
    await expect(page.getByRole("row", { name: new RegExp(productName) })).toBeVisible();

    // Broker
    await page.goto("/admin/brokers");
    await page.getByRole("button", { name: "Novo Broker" }).click();
    await page.getByRole("dialog").getByLabel("Código").fill(`B${suffix}`);
    await page.getByRole("dialog").locator('input[name="name"]').fill(brokerName);
    await page.getByRole("dialog").getByRole("button", { name: "Criar" }).click();
    await expect(page.getByRole("row", { name: new RegExp(brokerName) })).toBeVisible();

    // Contrato
    await page.goto("/contracts/new");
    // Nº Corretor/Broker: lista dos brokers cadastrados; o escolhido entra sozinho no quadro de comissão
    await page.getByLabel("Nº Corretor/Broker *").selectOption({ label: `B${suffix} · ${brokerName}` });
    await expect(page.locator('select[name="brokers.0.broker_id"] option:checked')).toHaveText(`B${suffix} · ${brokerName}`);
    await expect(page.locator('input[name="brokers.0.commission_percent"]')).toHaveCount(0);
    await page.locator('input[name="number_contract"]').fill(number);

    await page.getByPlaceholder("Buscar ou digitar o vendedor").fill(client);
    await page.getByRole("button", { name: new RegExp(client) }).click();
    await page.getByPlaceholder("Buscar ou digitar o comprador").fill("Comprador E2E (texto livre)");

    await page.getByRole("combobox").filter({ hasText: "Selecione o produto" }).click();
    await page.getByRole("option", { name: productName }).click();
    // O produto preenche a qualidade sozinho
    await expect(page.locator('input[name="quality"]')).toHaveValue("Padrão exportação");
    await page.locator('input[name="crop"]').fill("2025/2026");
    await page.locator('input[name="quantity"]').fill("1000");
    await page.locator('input[name="price"]').fill("120.5");
    await page.getByRole("button", { name: "Registrar Contrato" }).click();
    await expect(page).toHaveURL(/\/contracts$/);

    // Lista → /contracts/:id
    await page.getByPlaceholder("Buscar por nº contrato...").fill(number);
    await page.getByRole("button", { name: "Buscar" }).click();
    const row = page.getByRole("row", { name: new RegExp(number) });
    await expect(row).toContainText(productName);
    await expect(row).toContainText(client);
    await row.getByRole("link").first().click();

    await expect(page).toHaveURL(/\/contracts\/[\w-]+$/);
    await expect(page.getByRole("heading", { name: "Editar Contrato" })).toBeVisible();
    await expect(page.locator('input[name="number_contract"]')).toHaveValue(number);
    await expect(page.getByRole("combobox").filter({ hasText: productName })).toBeVisible();
    await expect(page.getByLabel("Nº Corretor/Broker *")).toHaveValue(`B${suffix}`);
    await expect(page.locator('select[name="brokers.0.broker_id"] option:checked')).toHaveText(`B${suffix} · ${brokerName}`);

    // Edição persiste
    await page.locator('input[name="quantity"]').fill("1500");
    await page.getByRole("button", { name: "Salvar Alterações" }).click();
    await expect(page).toHaveURL(/\/contracts$/);
    await page.getByPlaceholder("Buscar por nº contrato...").fill(number);
    await page.getByRole("button", { name: "Buscar" }).click();
    await page.getByRole("row", { name: new RegExp(number) }).getByRole("link").first().click();
    // coluna decimal: a API devolve "1500.0000"
    await expect(page.locator('input[name="quantity"]')).toHaveValue(/^1500(\.0+)?$/);
  });

  test("não registra sem campos obrigatórios", async ({ page }) => {
    await page.goto("/contracts/new");
    await page.getByRole("button", { name: "Registrar Contrato" }).click();
    await expect(page).toHaveURL(/\/contracts\/new$/);
    await expect(page.locator('select[name="number_broker"]')).toHaveClass(/border-destructive/);
    for (const name of ["number_contract", "crop", "quantity", "price"]) {
      await expect(page.locator(`input[name="${name}"]`)).toHaveClass(/border-destructive/);
    }
    await expect(page.getByRole("combobox").filter({ hasText: "Selecione o produto" })).toHaveClass(/border-destructive/);
  });
});
