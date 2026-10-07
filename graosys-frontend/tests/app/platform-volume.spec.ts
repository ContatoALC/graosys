import type { Page } from "@playwright/test";
import { test, expect } from "../support/fixtures";
import { adminApi, contractPayload, post, uid } from "../support/api";

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const card = (page: Page, title: string | RegExp) => page.locator("div.rounded-lg", { has: page.getByText(title) }).last();

// Passa o mouse sobre a coluna do mês no gráfico mensal e devolve o tooltip.
async function hoverMonth(page: Page, label: string) {
  const chart = card(page, / por mês$/);
  const tick = chart.locator(".recharts-cartesian-axis-tick-value", { hasText: label });
  await chart.scrollIntoViewIfNeeded();
  const box = (await tick.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y - 30);
  return chart.locator(".recharts-tooltip-wrapper");
}

test.describe("Painel de Controle › Volume", () => {
  test("contratos, toneladas e valor por corretora, mês e produto, sem cancelados", async ({ page }) => {
    test.setTimeout(30_000);
    // Mês próprio num ano antigo: outros specs criam contratos em paralelo na mesma corretora.
    const year = 1990 + Math.floor(Math.random() * 20);
    const month = 1 + Math.floor(Math.random() * 12);
    const date = `${year}-${String(month).padStart(2, "0")}-15`;
    const label = `${MONTHS[month - 1]}/${String(year).slice(2)}`;
    const id = uid();
    const product = `Grão VOL ${id}`;

    const api = await adminApi();
    const ids: string[] = [];
    try {
      // 2 contratos de 1.000 sc × R$ 100 (60 t e R$ 100.000 cada) + 1 cancelado
      for (const s of ["A", "B", "C"]) {
        const c = await post(api, "/api/contracts", contractPayload(`VOL-${id}-${s}`, { contract_emission_date: date, name_product: product }));
        ids.push(c.id);
      }
      expect((await api.patch(`/api/contracts/${ids[2]}/status`, { data: { status: "Cancelado" } })).ok()).toBeTruthy();

      // API: o mês isolado soma só os não cancelados; corretora interna fica fora por padrão
      const vol = await (await api.get("/api/platform/volume", { params: { from: date, to: date, include_internal: "true" } })).json();
      expect(vol.tenants.find((t: any) => t.internal)).toMatchObject({ contracts: 2, cancelled: 1, tons: 120, value_brl: 200000 });
      expect(vol.monthly).toEqual([{ month: date.slice(0, 7), contracts: 2, tons: 120, value_brl: 200000, value_usd: 0, tenants: 1 }]);
      expect(vol.products).toEqual([{ product, contracts: 2, tons: 120, value_brl: 200000, value_usd: 0 }]);
      const external = await (await api.get("/api/platform/volume", { params: { from: date, to: date } })).json();
      expect(external.tenants.some((t: any) => t.internal)).toBe(false);

      // Tela
      await page.goto("/platform/volume");
      await expect(page.getByRole("link", { name: "Volume" })).toHaveClass(/border-primary/);
      await expect(page.getByRole("heading", { name: "Toneladas por corretora" })).toBeVisible();
      await expect(page.getByText("Interna", { exact: true })).toHaveCount(0);

      await page.getByLabel("Período").selectOption("all");
      await page.getByLabel(/Incluir corretora interna/).check();
      const tenantsTable = card(page, /^Corretoras$/).getByRole("table");
      await expect(tenantsTable.getByRole("row").filter({ hasText: "Interna" })).toBeVisible();

      // KPI de contratos = soma da tabela
      let contracts = 0;
      for (const r of await tenantsTable.getByRole("row").filter({ hasNot: page.locator("th") }).all()) {
        contracts += Number((await r.getByRole("cell").nth(1).innerText()).replace(/\./g, ""));
      }
      await expect(page.locator("p", { hasText: /^Contratos$/ }).locator("xpath=..")).toContainText(contracts.toLocaleString("pt-BR"));

      // Gráfico mensal nas três métricas
      await expect(await hoverMonth(page, label)).toContainText("120 t");
      await page.getByRole("button", { name: "Contratos", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Contratos por mês" })).toBeVisible();
      await expect(await hoverMonth(page, label)).toContainText("2 contratos");
      await page.getByRole("button", { name: "Valor (R$)" }).click();
      await expect(page.getByRole("heading", { name: "Valor negociado (R$) por produto" })).toBeVisible();
      await expect(await hoverMonth(page, label)).toContainText("R$ 200.000");

      // Período de 12 meses não mostra o mês antigo
      await page.getByLabel("Período").selectOption("365");
      await expect(page.locator(".recharts-cartesian-axis-tick-value", { hasText: label })).toHaveCount(0);
    } finally {
      for (const cid of ids) await api.delete(`/api/contracts/${cid}`);
      await api.dispose();
    }
  });

  test("alerta corretoras ativas sem lançar contratos", async ({ page }) => {
    const id = uid();
    const name = `Corretora Parada E2E ${id}`;
    const api = await adminApi();
    const tenant = await post(api, "/api/platform/tenants", {
      name, slug: `e2e-parada-${id}`, admin_name: "Admin E2E", admin_email: `e2e.parada.${id}@graosys.test`, admin_password: "Senha-E2E-123",
    });
    try {
      await page.goto("/platform/volume");
      const alert = page.getByRole("region", { name: "Corretoras sem lançar contratos" });
      await expect(alert).toContainText(/sem lançar contratos há mais de 30 dias/);
      const row = alert.getByRole("row", { name: new RegExp(name) });
      await expect(row).toContainText("Nunca lançou contrato");
      await row.getByRole("link", { name }).click();
      await expect(page).toHaveURL(new RegExp(`/platform/tenants/${tenant.id}$`));
    } finally {
      // Não há exclusão de corretora: inativa para sair do alerta e das métricas.
      await api.patch(`/api/platform/tenants/${tenant.id}`, { data: { status: "inactive" } });
      await api.dispose();
    }
  });
});
