import type { Page } from "@playwright/test";
import { test, expect } from "../support/fixtures";
import { adminApi, contractPayload, post, uid } from "../support/api";

const today = () => new Date().toISOString().slice(0, 10);

// Status de cobrança mostrado na lista de contratos (coluna "Cobrança").
async function expectBillingStatus(page: Page, number: string, status: string) {
  await page.goto("/contracts");
  await page.getByPlaceholder("Buscar por nº contrato...").fill(number);
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page.getByRole("row", { name: new RegExp(number) }).getByRole("cell").nth(1)).toHaveText(status);
}

async function openNewReceipt(page: Page) {
  await page.goto("/billing/receipt");
  await page.getByRole("button", { name: "Novo Recebimento" }).click();
  return page.getByRole("dialog");
}

test.describe("Cobrança", () => {
  test("recebimentos mudam o status de cobrança do contrato", async ({ page }) => {
    test.setTimeout(30_000); // 3 recebimentos e 4 idas à lista de contratos
    const number = `R-${uid()}`;
    const api = await adminApi();
    const contract = await post(api, "/api/contracts", contractPayload(number));
    expect(Number(contract.commission_contract)).toBe(1000);
    await api.dispose();

    await expectBillingStatus(page, number, "A Faturar");

    // 1º recebimento, pendente: líquido = serviço − IRRF + ajuste
    let dialog = await openNewReceipt(page);
    await dialog.locator('input[name="number_contract"]').fill(number);
    await dialog.locator('input[name="number_broker"]').fill(`B-${number}`);
    await dialog.locator('input[name="product_name"]').fill("Soja E2E");
    await dialog.locator('input[name="total_service_value"]').fill("400");
    await dialog.locator('input[name="irrf_value"]').fill("6");
    await dialog.locator('input[name="adjustment_value"]').fill("-4");
    await expect(dialog.locator('input[name="liquid_value"]')).toHaveValue("390");
    await dialog.getByRole("button", { name: "Criar" }).click();
    await expect(dialog).toBeHidden();
    await page.getByPlaceholder("Buscar por nº contrato ou broker...").fill(number);
    const row = page.getByRole("row", { name: new RegExp(number) });
    await expect(row).toContainText("Pendente");
    await expect(row).toContainText("390,00");

    await expectBillingStatus(page, number, "A Receber");

    // Marca como recebido (400 de 1.000) → Parcial
    await page.goto("/billing/receipt");
    await page.getByPlaceholder("Buscar por nº contrato ou broker...").fill(number);
    await page.getByRole("row", { name: new RegExp(number) }).click();
    dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Editar Recebimento" })).toBeVisible();
    await dialog.locator('input[name="receipt_date"]').fill(today());
    await dialog.getByRole("combobox").click();
    await page.getByRole("option", { name: "Recebido" }).click();
    await dialog.getByRole("button", { name: "Salvar" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("row", { name: new RegExp(number) })).toContainText("Recebido");

    await expectBillingStatus(page, number, "Parcial");

    // Recebe o restante (600) → Recebido
    dialog = await openNewReceipt(page);
    await dialog.locator('input[name="number_contract"]').fill(number);
    await dialog.locator('input[name="number_broker"]').fill(`B-${number}`);
    await dialog.locator('input[name="product_name"]').fill("Soja E2E");
    await dialog.locator('input[name="receipt_date"]').fill(today());
    await dialog.locator('input[name="total_service_value"]').fill("600");
    await dialog.getByRole("combobox").click();
    await page.getByRole("option", { name: "Recebido" }).click();
    await dialog.getByRole("button", { name: "Criar" }).click();
    await expect(dialog).toBeHidden();

    await expectBillingStatus(page, number, "Recebido");
  });

  test("recebimento pendente com data prevista vencida deixa o contrato Em Atraso", async ({ page }) => {
    const number = `R-${uid()}`;
    const api = await adminApi();
    await post(api, "/api/contracts", contractPayload(number));
    await post(api, "/api/billings", {
      number_contract: number, number_broker: `B-${number}`, product_name: "Soja E2E", year: "2025",
      total_service_value: 1000, status: "pending", expected_receipt_date: "2025-01-10",
    });
    await api.dispose();

    await expectBillingStatus(page, number, "Em Atraso");
  });

  test("não cria recebimento sem os campos obrigatórios", async ({ page }) => {
    const dialog = await openNewReceipt(page);
    await dialog.getByRole("button", { name: "Criar" }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Novo Recebimento" })).toBeVisible();
  });
});
