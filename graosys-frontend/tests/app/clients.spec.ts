import { test, expect } from "../support/fixtures";
import { adminApi, contractPayload, post, uid } from "../support/api";

test.describe("Clientes", () => {
  test("cadastra, encontra na lista e edita um cliente", async ({ page }) => {
    test.setTimeout(20_000);
    const suffix = Date.now().toString().slice(-6);
    const name = `Cliente E2E ${suffix}`;

    await page.goto("/clients/new");
    await page.locator('input[name="name"]').fill(name);
    await page.locator('input[name="nickname"]').fill(`E2E${suffix}`);
    // 11 dígitos: não dispara a consulta de CNPJ externa
    await page.locator('input[name="cnpj_cpf"]').fill(`000${suffix}00`);
    await page.getByRole("button", { name: "Cadastrar Cliente" }).click();

    await expect(page).toHaveURL(/\/clients$/);
    await page.getByPlaceholder("Buscar por nome...").fill(name);
    await page.getByPlaceholder("Buscar por nome...").press("Enter"); // a lista mostra só os 50 primeiros
    const row = page.getByRole("row", { name: new RegExp(name) });
    await expect(row).toBeVisible();

    // /clients/:id
    await row.getByRole("link").first().click();
    await expect(page).toHaveURL(/\/clients\/[\w-]+$/);
    await expect(page.locator('input[name="name"]')).toHaveValue(name);
    await page.locator('input[name="nickname"]').fill(`E2E${suffix}-ed`);
    await page.getByRole("button", { name: "Salvar Alterações" }).click();
    await expect(page).toHaveURL(/\/clients$/);
  });

  test("não salva sem campos obrigatórios", async ({ page }) => {
    await page.goto("/clients/new");
    await page.getByRole("button", { name: "Cadastrar Cliente" }).click();
    await expect(page).toHaveURL(/\/clients\/new$/);
    await expect(page.locator('input[name="name"]')).toHaveClass(/border-destructive/);
  });

  test("cliente estrangeiro: sem CPF/CNPJ, com país de origem e documento do exterior", async ({ page }) => {
    test.setTimeout(20_000);
    const id = uid();
    const name = `Exportadora Estrangeira ${id} S.A.`;

    await page.goto("/clients/new");
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Estrangeira" }).click();
    // Estrangeira não fica com Brasil: o país é limpo para ser informado
    await expect(page.locator('input[name="country_code"]')).toHaveValue("");
    await expect(page.getByText("Documento (país de origem)")).toBeVisible();
    await page.locator('input[name="name"]').fill(name);
    await page.locator('input[name="nickname"]').fill(`EX${id}`);

    // Sem país não salva; CPF/CNPJ não é obrigatório
    await page.getByRole("button", { name: "Cadastrar Cliente" }).click();
    await expect(page).toHaveURL(/\/clients\/new$/);
    await expect(page.locator('input[name="cnpj_cpf"]')).not.toHaveClass(/border-destructive/);
    await expect(page.locator('input[name="country_code"]')).toHaveClass(/border-destructive/);

    await page.locator('input[name="country"]').fill("Paraguai");
    await expect(page.locator('input[name="country_code"]')).toHaveValue("PY");
    await page.locator('input[name="cnpj_cpf"]').fill(`RUC 8001${id}-6`);
    await page.getByRole("button", { name: "Cadastrar Cliente" }).click();
    await expect(page).toHaveURL(/\/clients$/);

    await page.getByPlaceholder("Buscar por nome...").fill(name);
    await page.getByPlaceholder("Buscar por nome...").press("Enter");
    const row = page.getByRole("row", { name: new RegExp(name) });
    await expect(row.getByLabel("Estrangeira")).toBeVisible();
    await expect(row).toContainText(`RUC 8001${id}-6`); // documento do exterior aparece como digitado
    await expect(row).toContainText("Paraguai");

    // Edição mantém o tipo
    await row.getByRole("link").first().click();
    await expect(page.getByRole("combobox").first()).toHaveText("Estrangeira");
  });

  test("API: tipo de cliente é PF, PJ ou EX, e estrangeira não pode ser do Brasil", async () => {
    const api = await adminApi();
    const id = uid();
    const base = { name: `Tipo ${id}`, nickname: `T${id}` };
    const invalid = await api.post("/api/clients", { data: { ...base, kind: "XX", cnpj_cpf: "1" } });
    expect(invalid.status()).toBe(400);
    const brazil = await api.post("/api/clients", { data: { ...base, kind: "EX", country: "Brasil" } });
    expect(brazil.status()).toBe(400);
    expect((await brazil.json()).error).toContain("país de origem");

    const foreign = await post(api, "/api/clients", { ...base, kind: "EX", country: "Argentina" });
    expect(foreign).toMatchObject({ kind: "EX", country_code: "AR", cnpj_cpf: "" });
    expect((await api.patch(`/api/clients/${foreign.id}`, { data: { country_code: "BR", country: "Brasil" } })).status()).toBe(400);

    // NFS-e: tomador estrangeiro não é cobrado de CPF/CNPJ, CEP nem UF
    await api.patch(`/api/clients/${foreign.id}`, { data: { address: "Av. Corrientes", number: "1200", city: "Buenos Aires" } });
    const contract = await post(api, "/api/contracts", contractPayload(`EX-${id}`, { seller: [base.name], seller_ids: [foreign.id] }));
    const nfse = await (await api.get(`/api/billings/nfse/${contract.id}`)).json();
    const tomador = nfse.notes.find((n: any) => n.party === "seller").tomador;
    expect(tomador).toMatchObject({ kind: "EX", country: "Argentina", missing: [] });
  });
});
