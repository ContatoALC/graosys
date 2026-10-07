import { test, expect } from "../support/fixtures";
import { adminApi, contractPayload, post, uid } from "../support/api";

// PDF do contrato direto da linha da lista (Contratos e Execução): o mesmo PDF anexado no e-mail,
// na via do vendedor ou do comprador, aberto em nova aba.
test.describe("PDF do contrato na lista", () => {
  test("abre a via escolhida em nova aba, em Contratos e em Execução", async ({ page }) => {
    test.setTimeout(30_000); // duas telas, uma aba nova em cada
    const number = `PDF-${uid()}`;
    const api = await adminApi();
    const contract = await post(api, "/api/contracts", contractPayload(number));

    const openVia = async (path: string, placeholder: string, via: string) => {
      await page.goto(path);
      await page.getByPlaceholder(placeholder).fill(number);
      await page.getByPlaceholder(placeholder).press("Enter");
      const row = page.getByRole("row", { name: new RegExp(number) });
      await row.getByTitle("Ver PDF do contrato").click();
      const pdfRequest = page.waitForRequest((r) => r.url().includes(`/api/contracts/${contract.id}/pdf`));
      const popup = page.waitForEvent("popup");
      await row.getByRole("menuitem", { name: via }).click();
      const [request, tab] = await Promise.all([pdfRequest, popup]);
      // O Chromium headless não tem visualizador de PDF: a aba nova recebe o PDF como download.
      const pdf = await tab.waitForEvent("download");
      expect(pdf.url()).toMatch(/^blob:/);
      expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);
      await tab.close();
      return new URL(request.url()).searchParams.get("role");
    };

    expect(await openVia("/contracts", "Buscar por nº contrato...", "Via do comprador")).toBe("Comprador");
    expect(await openVia("/execution", "Buscar contrato...", "Via do vendedor")).toBe("Vendedor");
  });

  test("a API devolve o PDF só para contratos da própria corretora", async () => {
    const api = await adminApi();
    const contract = await post(api, "/api/contracts", contractPayload(`PDF-${uid()}`));

    const res = await api.get(`/api/contracts/${contract.id}/pdf?role=Comprador`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("application/pdf");
    expect(res.headers()["content-disposition"]).toContain("_comprador.pdf");
    expect((await res.body()).subarray(0, 4).toString()).toBe("%PDF");

    const missing = await api.get("/api/contracts/00000000-0000-0000-0000-000000000000/pdf");
    expect(missing.status()).toBe(404);
  });
});
