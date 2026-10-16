import { test, expect } from "../support/fixtures";
import { adminApi, contractPayload, post, uid } from "../support/api";

test.describe("Relatórios", () => {
  test("filtro de produto acha pelo código ou pelo nome, sem diferenciar maiúsculas", async ({ page }) => {
    const id = uid();
    const api = await adminApi();
    // Código e nome bem diferentes, para provar que os dois são pesquisados
    const crop = `R${id}`;
    await post(api, "/api/contracts", contractPayload(`REL-${id}`, { product: `GIRASSOL${id}`, name_product: `Semente Oleaginosa ${id}`, crop }));

    const report = async (product: string) => (await (await api.get("/api/contracts/report", { params: { crop, product } })).json()).summary.count;
    expect(await report(`girassol${id}`)).toBe(1); // código em minúsculas
    expect(await report(`oleaginosa ${id}`)).toBe(1); // parte do nome
    expect(await report("produto-que-nao-existe")).toBe(0);

    await page.goto("/reports");
    await page.getByPlaceholder("ex: 2024/2025").fill(crop);
    await page.getByPlaceholder("ex: soja").fill(`oleaginosa ${id}`);
    await page.getByRole("button", { name: "Gerar Relatório" }).click();
    await expect(page.getByRole("row", { name: new RegExp(`REL-${id}`) })).toBeVisible();
  });
});
