import { request } from "@playwright/test";
import { test, expect } from "../support/fixtures";
import { API_URL, adminApi, contractPayload, post, uid, userApi } from "../support/api";

// Exclusão de corretora pelo Painel de Controle: irreversível, então só de corretora inativa/suspensa,
// com o nome digitado, e nunca a própria nem a interna da plataforma.
test.describe("Painel de Controle · excluir corretora", () => {
  test("inativa, confirma pelo nome e apaga a corretora com todos os dados", async ({ page }) => {
    test.setTimeout(30_000);
    const id = uid();
    const name = `Corretora Excluir ${id}`;
    const email = `e2e.excluir.${id}@graosys.test`;
    const password = "Senha-E2E-123";
    const api = await adminApi();
    const tenant = await post(api, "/api/platform/tenants", { name, slug: `e2e-excluir-${id}`, admin_name: "Admin E2E", admin_email: email, admin_password: password });

    // Dados da corretora (feitos pelo admin dela)
    const own = await userApi(email, password);
    await post(own, "/api/clients", { name: `Cliente ${id}`, nickname: `C${id}`, kind: "PF", cnpj_cpf: `222${id}` });
    await post(own, "/api/contracts", contractPayload(`DEL-${id}`));
    await own.dispose();

    // Pela API: ativa ou com nome errado não exclui
    expect((await api.delete(`/api/platform/tenants/${tenant.id}`, { data: { confirm_name: name } })).status()).toBe(400);

    await page.goto(`/platform/tenants/${tenant.id}`);
    const danger = page.getByTestId("danger-zone");
    await expect(danger.getByRole("button", { name: "Excluir corretora" })).toBeDisabled();
    await expect(danger).toContainText("primeiro mude o status");

    // Inativa e salva: o botão libera
    await page.locator("select").filter({ has: page.locator('option[value="inactive"]') }).selectOption("inactive");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByText("Corretora atualizada")).toBeVisible();
    expect((await api.delete(`/api/platform/tenants/${tenant.id}`, { data: { confirm_name: "outro nome" } })).status()).toBe(400);

    await danger.getByRole("button", { name: "Excluir corretora" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("1 contrato(s)");
    const confirm = dialog.getByRole("button", { name: "Excluir definitivamente" });
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel(/para confirmar/).fill(name);
    await confirm.click();
    await expect(page).toHaveURL(/\/platform$/);

    // Sumiu a corretora e o login do admin dela
    expect((await api.get(`/api/platform/tenants/${tenant.id}`)).status()).toBe(404);
    const anon = await request.newContext({ baseURL: API_URL });
    expect((await anon.post("/api/auth/login", { data: { email, password } })).ok()).toBeFalsy();
    await anon.dispose();
  });

  test("a própria corretora (interna da plataforma) não pode ser excluída", async ({ page }) => {
    const api = await adminApi();
    const own = await (await api.get("/api/tenant")).json();
    const res = await api.delete(`/api/platform/tenants/${own.id}`, { data: { confirm_name: own.name } });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toContain("própria corretora");

    await page.goto(`/platform/tenants/${own.id}`);
    await expect(page.getByRole("heading", { name: own.name })).toBeVisible();
    await expect(page.getByTestId("danger-zone")).toHaveCount(0);
  });
});
