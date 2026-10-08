import type { Page } from "@playwright/test";
import { test, expect } from "../support/fixtures";
import { adminApi, contractPayload, post, uid } from "../support/api";

const kpi = (page: Page, label: string) => page.locator("p", { hasText: new RegExp(`^${label}$`) }).locator("xpath=..");

test.describe("Comissões de brokers", () => {
  test("tabela de % por data define a comissão de cada contrato e a parte liberada", async ({ page }) => {
    test.setTimeout(30_000);
    const id = uid();
    const brokerName = `Broker Tabela ${id}`;
    const api = await adminApi();
    const broker = await post(api, "/api/brokers", { name: brokerName, active: true });

    // Tabela de comissão pela tela: 20% a partir de 2024, 30% a partir de 2025
    await page.goto("/admin/brokers");
    const brokerRow = page.getByRole("row", { name: new RegExp(brokerName) });
    await brokerRow.getByTitle("Tabela de comissão").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Nenhum % cadastrado")).toBeVisible();
    for (const [pct, from] of [["20", "01/01/2024"], ["30", "01/01/2025"]]) {
      await dialog.getByPlaceholder("ex.: 0,50").fill(pct);
      await dialog.getByLabel("A partir de").fill(from);
      await dialog.getByRole("button", { name: "Adicionar" }).click();
      await expect(dialog.getByRole("row", { name: new RegExp(`${pct}%`) })).toBeVisible();
    }
    await expect(dialog.getByRole("row", { name: /30%/ })).toContainText("Atual");
    await dialog.getByRole("button", { name: "Fechar" }).first().click();
    await expect(brokerRow).toContainText("30%");

    // Contratos de R$ 1.000 de comissão da corretora cada
    const n = (s: string) => `BC-${id}-${s}`;
    const withBroker = (date: string, commission_percent: number | null) =>
      ({ contract_emission_date: date, brokers: [{ broker_id: broker.id, commission_percent }] });
    await post(api, "/api/contracts", contractPayload(n("A"), withBroker("2024-06-01", null))); // tabela 2024 → 20%
    await post(api, "/api/contracts", contractPayload(n("B"), withBroker("2025-06-01", null))); // tabela 2025 → 30%
    await post(api, "/api/contracts", contractPayload(n("C"), withBroker("2025-07-01", 50)));   // % do contrato → 50%
    // Corretora recebeu metade do contrato B → libera metade da parte do broker
    await post(api, "/api/billings", {
      number_contract: n("B"), number_broker: `B-${n("B")}`, product_name: "Soja E2E", year: "2025",
      receipt_date: "2025-08-01", total_service_value: 500, status: "received",
    });
    await api.dispose();

    await page.goto("/broker-commissions");
    await expect(page.getByRole("heading", { name: "Comissões dos Brokers" })).toBeVisible();
    await page.locator("select").filter({ has: page.locator("option", { hasText: brokerName }) }).selectOption({ label: brokerName });
    await page.locator("select").filter({ hasText: "Todo o período" }).selectOption("all");

    const row = (s: string) => page.getByRole("row", { name: new RegExp(n(s)) });
    await expect(row("A")).toContainText("20%");
    await expect(row("A")).toContainText("200,00");
    await expect(row("B")).toContainText("30%");
    await expect(row("B")).toContainText("300,00");
    await expect(row("B")).toContainText("150,00"); // liberada
    await expect(row("B")).toContainText("Parcial");
    await expect(row("C")).toContainText("50%");
    await expect(row("C")).toContainText("500,00");
    await expect(row("C")).toContainText("A Receber");

    await expect(kpi(page, "Comissão do broker")).toContainText("1.000,00");
    await expect(kpi(page, "Liberada")).toContainText("150,00");
    await expect(kpi(page, "A receber")).toContainText("850,00");
    await expect(kpi(page, "Contratos")).toContainText("3");

    // Período padrão (12 meses) não inclui os contratos de 2024/2025
    await page.locator("select").filter({ hasText: "Todo o período" }).selectOption("365");
    await expect(row("A")).toBeHidden();

    // Aba de produtividade
    await page.locator("select").filter({ hasText: "Todo o período" }).selectOption("all");
    await page.getByRole("button", { name: "Produtividade" }).click();
    const ranking = page.getByRole("row", { name: new RegExp(brokerName) });
    await expect(ranking).toContainText("1.000,00");
    await expect(ranking.getByRole("cell").nth(1)).toHaveText("3");
  });
});
