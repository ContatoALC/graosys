import { test, expect } from "../support/fixtures";

// Campo de data (date picker do shadcn): digita dd/mm/aaaa ou escolhe no calendário; grava AAAA-MM-DD.
test.describe("Campo de data", () => {
  test("digitar, escolher no calendário, Hoje e Limpar", async ({ page }) => {
    await page.goto("/contracts/new");
    const input = page.getByLabel("Data de Emissão");

    // Digitação com máscara: as barras entram sozinhas
    await input.pressSequentially("05032026");
    await expect(input).toHaveValue("05/03/2026");

    // Data inválida volta para a última válida ao sair do campo
    await input.fill("31/02/2026");
    await input.blur();
    await expect(input).toHaveValue("05/03/2026");

    // Calendário abre no mês da data e marca o dia escolhido
    const field = input.locator("..");
    await field.getByRole("button", { name: "Abrir calendário" }).click();
    const calendar = page.getByRole("dialog");
    await expect(calendar.getByRole("grid")).toContainText("1");
    await calendar.getByRole("button", { name: /20 de março de 2026/i }).click();
    await expect(input).toHaveValue("20/03/2026");

    await field.getByRole("button", { name: "Abrir calendário" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Hoje" }).click();
    await expect(input).toHaveValue(new Date().toLocaleDateString("pt-BR"));

    await field.getByRole("button", { name: "Abrir calendário" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Limpar" }).click();
    await expect(input).toHaveValue("");
  });
});
