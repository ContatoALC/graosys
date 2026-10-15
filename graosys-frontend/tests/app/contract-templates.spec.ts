import { test, expect } from "../support/fixtures";
import { adminApi, contractPayload, post, uid, userApi } from "../support/api";
import { contractPdf } from "../support/pdf";

// Modelos de contrato: cada corretora monta o PDF por tipo de contrato (idioma, campos, cláusulas com variáveis,
// visual). O contrato escolhe o modelo; sem escolha, vale o padrão da corretora.
test.describe("Modelos de contrato", () => {
  test("modelo em inglês criado pela tela, com cláusula e variável, sai no PDF do contrato", async ({ page }) => {
    test.setTimeout(30_000); // criação, edição com prévia e dois PDFs
    const id = uid();
    const name = `Export EN ${id}`;

    await page.goto("/admin/pdf-layout");
    await page.getByRole("button", { name: "Novo modelo" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nome").fill(name);
    await dialog.getByLabel("Idioma").selectOption({ label: "Inglês" });
    await dialog.getByRole("button", { name: "Criar e editar" }).click();
    await expect(page).toHaveURL(/\/admin\/pdf-layout\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(page.getByLabel("Título do documento")).toHaveValue("CONTRACT CONFIRMATION");

    // Campo com rótulo próprio e outro escondido
    await page.getByRole("tab", { name: "Campos" }).click();
    await page.getByLabel("Rótulo de Quality").fill("Specs");
    await page.getByLabel("Mostrar ICMS").uncheck();

    // Cláusula: a variável entra onde está o cursor
    await page.getByRole("tab", { name: /Cláusulas/ }).click();
    await page.getByRole("button", { name: "Adicionar cláusula" }).click();
    await page.getByLabel("Título da cláusula 1").fill("Arbitration");
    const body = page.getByLabel("Texto da cláusula 1");
    await body.fill("Buyer: ");
    await page.getByRole("button", { name: "{{comprador}}" }).click();
    await body.press("End");
    await body.pressSequentially(" accepts **GAFTA** rules.");
    await expect(body).toHaveValue("Buyer: {{comprador}} accepts **GAFTA** rules.");
    await expect(page.getByTitle("Prévia do PDF")).toBeAttached(); // a prévia ao vivo gerou o PDF do rascunho
    await page.getByRole("button", { name: "Salvar modelo" }).click();
    await expect(page.getByText("Modelo salvo")).toBeVisible();

    // Contrato com o modelo: PDF em inglês, com a variável trocada pelo comprador
    const api = await adminApi();
    const templateId = page.url().split("/").pop();
    const contract = await post(api, "/api/contracts", contractPayload(`TPL-EN-${id}`, { template_id: templateId, quality: "Moisture 14%" }));
    const pdf = await contractPdf(api, contract.id, "Comprador");
    expect(pdf.filename).toContain("_buyer.pdf");
    expect(pdf.text).toContain("CONTRACT CONFIRMATION - BUYER");
    expect(pdf.text).toContain("Crop 2025/2026");
    expect(pdf.text).toContain("Specs Moisture 14%");
    expect(pdf.text).not.toContain("ICMS");
    expect(pdf.text).toContain("1. Arbitration");
    expect(pdf.text).toContain("Buyer: Comprador E2E accepts GAFTA rules.");
    expect(pdf.text).toContain("Quantity 1,000 sc");

    // Contrato sem modelo continua no padrão da corretora, em português
    const plain = await post(api, "/api/contracts", contractPayload(`TPL-PT-${id}`));
    const ptPdf = await contractPdf(api, plain.id);
    expect(ptPdf.filename).toContain("_vendedor.pdf");
    expect(ptPdf.text).toContain("CONFIRMAÇÃO DE CONTRATO - VENDEDOR");
    expect(ptPdf.text).toContain("Quantidade 1.000 sc");
    await api.dispose();
  });

  test("variável desconhecida aparece na prévia e não é salva", async ({ page }) => {
    const api = await adminApi();
    const template = await post(api, "/api/contract-templates", { name: `Inválido ${uid()}`, language: "pt-BR" });

    await page.goto(`/admin/pdf-layout/${template.id}`);
    await page.getByRole("tab", { name: /Cláusulas/ }).click();
    await page.getByRole("button", { name: "Adicionar cláusula" }).click();
    await page.getByLabel("Texto da cláusula 1").fill("Preço {{preco_final}}");
    await expect(page.getByRole("alert")).toHaveText("Variável desconhecida: {{preco_final}}");
    await page.getByRole("button", { name: "Salvar modelo" }).click();
    await expect(page.getByText("Variável desconhecida: {{preco_final}}").last()).toBeVisible();

    const saved = await (await api.get(`/api/contract-templates/${template.id}`)).json();
    expect(saved.clauses).toEqual([]);
    await api.delete(`/api/contract-templates/${template.id}`);
    await api.dispose();
  });

  test("contrato escolhe o modelo na tela; modelo em uso é arquivado em vez de excluído", async ({ page }) => {
    test.setTimeout(20_000); // edição do contrato + lista de modelos
    const id = uid();
    const api = await adminApi();
    const template = await post(api, "/api/contract-templates", { name: `Mercado interno ${id}`, language: "pt-BR" });
    // Broker e produto cadastrados: o formulário só salva com eles escolhidos nas listas
    await post(api, "/api/brokers", { name: `Broker ${id}`, code: `T${id}` });
    await post(api, "/api/products", { product_type: `TPL${id}`, name: `Produto TPL ${id}` });
    const contract = await post(api, "/api/contracts", contractPayload(`TPL-SEL-${id}`, { number_broker: `T${id}`, product: `TPL${id}`, name_product: `Produto TPL ${id}` }));

    await page.goto(`/contracts/${contract.id}`);
    const select = page.getByLabel("Modelo do contrato (PDF)");
    await expect(select).toHaveValue("");
    await select.selectOption({ label: `Mercado interno ${id} · Português` });
    await page.getByRole("button", { name: "Salvar Alterações" }).click();
    await expect(page).toHaveURL(/\/contracts$/);
    expect((await (await api.get(`/api/contracts/${contract.id}`)).json()).template_id).toBe(template.id);

    // Em uso: "excluir" arquiva; o PDF do contrato continua saindo
    await page.goto("/admin/pdf-layout");
    const row = page.getByRole("row", { name: new RegExp(`Mercado interno ${id}`) });
    await row.getByTitle("Excluir").click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Excluir" }).click();
    await expect(page.getByText("Modelo arquivado (já usado em contratos)")).toBeVisible();
    await expect(row.getByText("Arquivado")).toBeVisible();
    expect((await contractPdf(api, contract.id)).text).toContain("CONFIRMAÇÃO DE CONTRATO");

    // Arquivado não pode ser escolhido por outro contrato
    const other = await post(api, "/api/contracts", contractPayload(`TPL-ARQ-${id}`));
    const res = await api.patch(`/api/contracts/${other.id}`, { data: { template_id: template.id } });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toBe("Este modelo de contrato está arquivado");

    // Modelo sem uso é excluído de vez; o padrão não sai
    const unused = await post(api, "/api/contract-templates", { name: `Sem uso ${id}`, language: "en" });
    expect(await (await api.delete(`/api/contract-templates/${unused.id}`)).json()).toEqual({ archived: false });
    const list = await (await api.get("/api/contract-templates")).json();
    const def = list.find((t: any) => t.is_default);
    const delDefault = await api.delete(`/api/contract-templates/${def.id}`);
    expect(delDefault.status()).toBe(400);
    await api.dispose();
  });

  test("usuário comum vê a lista para escolher no contrato, mas não edita modelos", async () => {
    const admin = await adminApi();
    const email = `modelo.${uid()}@e2e.test`;
    const password = "Senha-E2E-123";
    await post(admin, "/api/users", { name: "Usuário Modelos", email, password, role: "user", permissions: { contracts: ["view", "edit"] } });
    const api = await userApi(email, password);

    const list = await api.get("/api/contract-templates");
    expect(list.status()).toBe(200);
    const [first] = await list.json();
    expect((await api.get(`/api/contract-templates/${first.id}`)).status()).toBe(403);
    expect((await api.put(`/api/contract-templates/${first.id}`, { data: { name: "Hack" } })).status()).toBe(403);
    expect((await api.post("/api/contract-templates", { data: { name: "Hack" } })).status()).toBe(403);
    await api.dispose();
    await admin.dispose();
  });
});
