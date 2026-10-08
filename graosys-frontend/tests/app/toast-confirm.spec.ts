import { test, expect } from "../support/fixtures";
import { adminApi, contractPayload, post, uid } from "../support/api";

// Avisos em toast (Sonner) e confirmações no visual do sistema, no lugar de alert()/confirm() do navegador.
test.describe("Toast e confirmação", () => {
  test("clonar contrato pede confirmação; Cancelar não clona; Clonar mostra o toast", async ({ page }) => {
    const number = `TST-${uid()}`;
    const api = await adminApi();
    await post(api, "/api/contracts", contractPayload(number));
    let nativeDialog = false;
    page.on("dialog", (d) => { nativeDialog = true; d.dismiss(); });

    await page.goto("/contracts");
    await page.getByPlaceholder("Buscar por nº contrato...").fill(number);
    await page.getByRole("button", { name: "Buscar" }).click();
    const row = page.getByRole("row", { name: new RegExp(number) });

    await row.getByTitle("Clonar contrato").click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toContainText(`Clonar o contrato ${number}?`);
    await confirm.getByRole("button", { name: "Cancelar" }).click();
    await expect(confirm).toBeHidden();
    await expect(page).toHaveURL(/\/contracts$/);

    await row.getByTitle("Clonar contrato").click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Clonar" }).click();
    await expect(page).toHaveURL(/\/contracts\/[\w-]+$/);
    await expect(page.getByText(/^Contrato clonado: /)).toBeVisible();
    expect(nativeDialog).toBe(false);
  });

  test("mover o contrato no fluxo mostra um toast de confirmação", async ({ page }) => {
    const number = `TST-${uid()}`;
    const api = await adminApi();
    await post(api, "/api/contracts", contractPayload(number));
    await page.goto("/contracts");
    await page.getByPlaceholder("Buscar por nº contrato...").fill(number);
    await page.getByRole("button", { name: "Buscar" }).click();
    await page.getByRole("row", { name: new RegExp(number) }).getByRole("button", { name: "Enviar para Execução" }).click();
    await expect(page.getByText(`Enviado para a Execução · ${number}`)).toBeVisible();
  });
});
