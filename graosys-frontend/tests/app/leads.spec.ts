import { test, expect } from "../support/fixtures";
import { uid } from "../support/api";

test.describe("Leads (superadmin)", () => {
  test("cria, move de etapa, edita a ficha e remove um lead", async ({ page }) => {
    test.setTimeout(20_000);
    const name = `Lead E2E ${uid()}`;

    await page.goto("/platform/leads");
    await page.getByRole("button", { name: "Novo lead" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator('input[name="name"]').fill(name);
    await dialog.locator('input[name="region"]').fill("Curitiba-PR");
    await dialog.locator('input[name="decision_maker"]').fill("Fulano E2E");
    await dialog.getByRole("button", { name: "Criar" }).click();
    await expect(dialog).toBeHidden();

    // Card no quadro, movido de etapa pelo seletor
    await page.getByPlaceholder("Buscar por nome, praça ou decisor...").fill(name);
    await page.getByRole("button", { name: "Buscar" }).click();
    const card = page.locator("div.rounded-lg", { has: page.getByRole("link", { name }) }).last();
    await expect(card).toContainText("Curitiba-PR");
    await expect(card.locator("select")).toHaveValue("a_contatar");
    const moved = page.waitForResponse((r) => r.url().includes("/api/platform/leads/") && r.request().method() === "PATCH");
    await card.locator("select").selectOption({ label: "Ligação feita" });
    expect((await moved).ok()).toBeTruthy();

    // /platform/leads/:id
    await page.getByRole("link", { name }).click();
    await expect(page).toHaveURL(/\/platform\/leads\/[\w-]+$/);
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(page.locator('select[name="status"]')).toHaveValue("ligacao_feita");
    await page.locator('input[name="next_step"]').fill("Agendar demo");
    await page.locator('input[name="next_step_date"]').fill("15/01/2030");
    await page.getByRole("button", { name: "Adicionar telefone" }).click();
    await page.locator('input[name="phones.0.number"]').fill("(41) 3333-4444");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Lead salvo")).toBeVisible();

    await page.reload();
    await expect(page.locator('input[name="next_step"]')).toHaveValue("Agendar demo");
    await expect(page.locator('input[name="next_step_date"]')).toHaveValue("15/01/2030");
    await expect(page.locator('input[name="phones.0.number"]')).toHaveValue("(41) 3333-4444");

    // Confirmação no visual do sistema (não é mais o confirm() do navegador)
    await page.getByRole("button", { name: "Remover lead" }).click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toContainText("Remover este lead?");
    await confirm.getByRole("button", { name: "Remover" }).click();
    await expect(page.getByText("Lead removido")).toBeVisible();
    await expect(page).toHaveURL(/\/platform\/leads$/);
    await page.getByPlaceholder("Buscar por nome, praça ou decisor...").fill(name);
    await page.getByRole("button", { name: "Buscar" }).click();
    await expect(page.getByRole("link", { name })).toHaveCount(0);
  });

  test("não cria lead sem nome", async ({ page }) => {
    await page.goto("/platform/leads");
    await page.getByRole("button", { name: "Novo lead" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Criar" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});
