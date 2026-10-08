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

  test("dois brokers no mesmo contrato: cada um recebe o seu % sobre a comissão, liberado pelo que a corretora recebeu", async () => {
    const id = uid();
    const api = await adminApi();
    const a = await post(api, "/api/brokers", { name: `Dois A ${id}`, code: `DA${id}` });
    const b = await post(api, "/api/brokers", { name: `Dois B ${id}`, code: `DB${id}` });
    await post(api, `/api/brokers/${a.id}/rates`, { percent: 20, valid_from: "2024-01-01" });
    await post(api, `/api/brokers/${b.id}/rates`, { percent: 10, valid_from: "2024-01-01" });
    const number = `DUO-${id}`;
    // 1000 sc × R$ 100, 1% do vendedor → R$ 1.000 de comissão da corretora
    await post(api, "/api/contracts", contractPayload(number, {
      contract_emission_date: "2026-10-01",
      brokers: [{ broker_id: a.id, commission_percent: null }, { broker_id: b.id, commission_percent: null }],
    }));
    const row = async (brokerId: string) => {
      const s = await (await api.get(`/api/broker-portal/summary?broker_id=${brokerId}`)).json();
      return s.contracts.find((c: any) => c.number_contract === number);
    };
    expect(await row(a.id)).toMatchObject({ percent: 20, broker_commission: 200, released: 0, pending: 200 });
    expect(await row(b.id)).toMatchObject({ percent: 10, broker_commission: 100, released: 0, pending: 100 });

    const receipt = { number_contract: number, number_broker: `DA${id}`, product_name: "Soja E2E", year: "2026", status: "received", receipt_date: "2026-10-05" };
    await post(api, "/api/billings", { ...receipt, total_service_value: 400 });
    expect(await row(a.id)).toMatchObject({ released: 80, pending: 120 });
    expect(await row(b.id)).toMatchObject({ released: 40, pending: 60 });

    await post(api, "/api/billings", { ...receipt, total_service_value: 600 });
    expect(await row(a.id)).toMatchObject({ released: 200, pending: 0 });
    expect(await row(b.id)).toMatchObject({ released: 100, pending: 0 });

    // Vigência nova vale só para a frente: o contrato de outubro continua com 20%
    await post(api, `/api/brokers/${a.id}/rates`, { percent: 30, valid_from: "2026-11-01" });
    expect(await row(a.id)).toMatchObject({ percent: 20, broker_commission: 200 });
  });

  test("vigência retroativa (nova ou excluída) não deixa os brokers de um contrato passarem de 100%", async () => {
    const id = uid();
    const api = await adminApi();
    const x = await post(api, "/api/brokers", { name: `Lim X ${id}`, code: `LX${id}` });
    const y = await post(api, "/api/brokers", { name: `Lim Y ${id}`, code: `LY${id}` });
    await post(api, `/api/brokers/${x.id}/rates`, { percent: 80, valid_from: "2024-01-01" });
    await post(api, `/api/brokers/${y.id}/rates`, { percent: 30, valid_from: "2024-01-01" });
    const lowered = await post(api, `/api/brokers/${y.id}/rates`, { percent: 10, valid_from: "2026-09-01" });
    const number = `LIM-${id}`;
    await post(api, "/api/contracts", contractPayload(number, {
      contract_emission_date: "2026-10-01",
      brokers: [{ broker_id: x.id, commission_percent: null }, { broker_id: y.id, commission_percent: null }],
    })); // 80% + 10% = 90%

    // Nova vigência com início antes do contrato: 80% + 50% = 130% → recusada, nada gravado
    const retro = await api.post(`/api/brokers/${y.id}/rates`, { data: { percent: 50, valid_from: "2026-09-15" } });
    expect(retro.status()).toBe(400);
    expect((await retro.json()).error).toContain(`${number} (130%)`);
    expect((await (await api.get(`/api/brokers/${y.id}/rates`)).json()).map((r: any) => r.valid_from)).not.toContain("2026-09-15");

    // Excluir a vigência de 10% faria o contrato voltar para 30% (110%) → recusada
    const del = await api.delete(`/api/brokers/${y.id}/rates/${lowered.id}`);
    expect(del.status()).toBe(400);
    expect((await del.json()).error).toContain(`${number} (110%)`);

    // Depois do contrato, pode
    expect((await api.post(`/api/brokers/${y.id}/rates`, { data: { percent: 50, valid_from: "2026-11-01" } })).status()).toBe(201);
  });
});
