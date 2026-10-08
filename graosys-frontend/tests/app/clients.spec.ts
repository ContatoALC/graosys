import { test, expect } from "../support/fixtures";

test.describe("Clientes", () => {
  test("cadastra, encontra na lista e edita um cliente", async ({ page }) => {
    test.setTimeout(20_000);
    const suffix = Date.now().toString().slice(-6);
    const name = `Cliente E2E ${suffix}`;

    await page.goto("/clients/new");
    await page.locator('input[name="name"]').fill(name);
    await page.locator('input[name="nickname"]').fill(`E2E${suffix}`);
    // 11 dígitos: não dispara a consulta de CNPJ externa
    await page.locator('input[name="cnpj_cpf"]').fill(`000${suffix}00`);
    await page.getByRole("button", { name: "Cadastrar Cliente" }).click();

    await expect(page).toHaveURL(/\/clients$/);
    await page.getByPlaceholder("Buscar por nome...").fill(name);
    await page.getByPlaceholder("Buscar por nome...").press("Enter"); // a lista mostra só os 50 primeiros
    const row = page.getByRole("row", { name: new RegExp(name) });
    await expect(row).toBeVisible();

    // /clients/:id
    await row.getByRole("link").first().click();
    await expect(page).toHaveURL(/\/clients\/[\w-]+$/);
    await expect(page.locator('input[name="name"]')).toHaveValue(name);
    await page.locator('input[name="nickname"]').fill(`E2E${suffix}-ed`);
    await page.getByRole("button", { name: "Salvar Alterações" }).click();
    await expect(page).toHaveURL(/\/clients$/);
  });

  test("não salva sem campos obrigatórios", async ({ page }) => {
    await page.goto("/clients/new");
    await page.getByRole("button", { name: "Cadastrar Cliente" }).click();
    await expect(page).toHaveURL(/\/clients\/new$/);
    await expect(page.locator('input[name="name"]')).toHaveClass(/border-destructive/);
  });
});
