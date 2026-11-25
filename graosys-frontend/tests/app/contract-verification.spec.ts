import { request } from "@playwright/test";
import { test, expect } from "../support/fixtures";
import { API_URL, adminApi, contractPayload, post, uid } from "../support/api";
import { contractPdf } from "../support/pdf";

// QR code no PDF do contrato: aponta para /verificar/:id, página pública que funciona como selo de autenticidade
// (corretora, nº, produto, emissão e se está cancelado), sem partes, volume nem preço.
test.describe("Verificação do contrato pelo QR code", () => {
  // Quem escaneia o QR code não tem login no GraoSys.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("o PDF traz o link e a página pública confere o contrato, inclusive cancelado", async ({ page }) => {
    test.setTimeout(15_000); // PDF + duas visitas à página
    const number = `VRF-${uid()}`;
    const api = await adminApi();
    const contract = await post(api, "/api/contracts", contractPayload(number, { list_email_seller: ["vendedor@verifica.test"] }));

    const { text } = await contractPdf(api, contract.id, "Comprador");
    expect(text).toContain("Confira a autenticidade deste contrato");
    // O pdfjs separa a URL com espaços onde ela quebra; compara sem eles.
    expect(text.replace(/\s/g, "")).toContain(`/verificar/${contract.id}`);

    await page.goto(`/verificar/${contract.id}`);
    await expect(page).toHaveURL(new RegExp(`/verificar/${contract.id}$`)); // não manda para o login
    await expect(page.getByText("Contrato autêntico")).toBeVisible();
    await expect(page.getByText(number)).toBeVisible();
    await expect(page.getByText(/Soja E2E/)).toBeVisible();
    // Selo enxuto: partes, volume, preço e dados internos ficam de fora
    for (const hidden of ["Vendedor E2E", "Comprador E2E", "R$ 100,00", "1.000", "vendedor@verifica.test"]) {
      await expect(page.getByText(hidden)).toHaveCount(0);
    }
    await expect(page.getByText(/comiss/i)).toHaveCount(0);

    await post(api, `/api/contracts/${contract.id}/workflow`, { action: "cancel", reason: "Teste de verificação" });
    await page.reload();
    await expect(page.getByText("Contrato cancelado")).toBeVisible();
  });

  test("código inexistente avisa que o contrato não foi encontrado", async ({ page }) => {
    await page.goto("/verificar/00000000-0000-4000-8000-000000000000");
    await expect(page.getByText("Contrato não encontrado")).toBeVisible();
    await page.goto("/verificar/nao-e-um-codigo");
    await expect(page.getByText("Contrato não encontrado")).toBeVisible();
  });

  test("a API pública não expõe partes, preço, comissão, e-mails nem conta de pagamento", async () => {
    const api = await adminApi();
    const contract = await post(api, "/api/contracts", contractPayload(`VRF-${uid()}`, { list_email_buyer: ["comprador@verifica.test"] }));
    const anon = await request.newContext({ baseURL: API_URL });
    const res = await anon.get(`/api/public/contracts/${contract.id}/verify`);
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain(contract.number_contract);
    expect(body).not.toMatch(/seller|buyer|price|quantity|commission|list_email|payment_account|Vendedor E2E|Comprador E2E|comprador@verifica\.test/);
    // Fora dos buscadores e de caches
    expect(res.headers()["x-robots-tag"]).toContain("noindex");
    expect(res.headers()["cache-control"]).toContain("no-store");

    // A consulta fica na auditoria da corretora
    const audit = await (await api.get(`/api/audit?action=contracts.verify&search=${contract.id}`)).json();
    expect(audit.data.some((a: any) => a.entity_id === contract.id && a.status_code === 200)).toBeTruthy();
  });
});
