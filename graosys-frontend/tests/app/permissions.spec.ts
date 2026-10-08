import { test, expect } from "../support/fixtures";
import { adminApi, post, uid, userApi } from "../support/api";

test.describe("Permissões (usuário comum)", () => {
  test("só acessa os módulos liberados e ganha acesso pelo Controle de Acesso", async ({ page, browser }, testInfo) => {
    test.setTimeout(30_000);
    const id = uid();
    const name = `Usuário E2E ${id}`;
    const email = `e2e.user.${id}@graosys.test`;
    const password = "Senha-E2E-123";
    const admin = await adminApi();
    const user = await post(admin, "/api/users", { name, email, password, role: "user", permissions: { clients: ["view"] } });

    // Sessão própria do usuário comum (sem o storageState do superadmin)
    const ctx = await browser.newContext({ baseURL: testInfo.project.use.baseURL, storageState: { cookies: [], origins: [] } });
    const userPage = await ctx.newPage();
    try {
      await userPage.goto("/login");
      await userPage.locator("#email").fill(email);
      await userPage.locator("#password").fill(password);
      await userPage.getByRole("button", { name: "Entrar" }).click();
      await expect(userPage).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

      // Menu: sem itens de admin, gerência, comissões ou plataforma
      const nav = userPage.locator("aside");
      await expect(nav.getByRole("link", { name: "Clientes" })).toBeVisible();
      for (const item of ["Admin", "Gerência", "Comissões Brokers", "Painel de Controle"]) {
        await expect(nav.getByRole("link", { name: item })).toHaveCount(0);
      }

      // Telas restritas redirecionam para o dashboard
      for (const path of ["/admin/users", "/admin/access", "/management", "/platform"]) {
        await userPage.goto(path);
        await expect(userPage, `${path} deveria redirecionar`).toHaveURL(/\/dashboard$/);
      }

      // A API respeita as permissões, não só a tela
      const api = await userApi(email, password);
      expect((await api.get("/api/clients")).status()).toBe(200);
      expect((await api.post("/api/clients", { data: { name: "Não pode" } })).status()).toBe(403);
      expect((await api.get("/api/contracts")).status()).toBe(403);
      expect((await api.get("/api/billings")).status()).toBe(403);
      expect((await api.get("/api/users")).status()).toBe(403);

      // Admin libera "Contratos → Visualizar" pela tela de Controle de Acesso
      await page.goto("/admin/access");
      const card = page.locator("div.rounded-lg", { has: page.getByText(email) }).first();
      await card.getByRole("row", { name: /Contratos/ }).getByRole("checkbox").first().check();
      const saved = page.waitForResponse((r) => r.url().includes(`/api/users/${user.id}`) && r.request().method() === "PATCH");
      await card.getByRole("button", { name: "Salvar" }).click();
      expect((await saved).ok()).toBeTruthy();
      await expect(page.getByText("Permissões salvas")).toBeVisible(); // toast
      await api.dispose();

      // O backend guarda permissões por sessão por até 30s (authMiddleware); uma sessão nova já vê a mudança.
      const api2 = await userApi(email, password);
      expect((await api2.get("/api/contracts")).status()).toBe(200);
      expect((await api2.post("/api/contracts", { data: {} })).status()).toBe(403); // só visualizar
      await api2.dispose();

      await userPage.evaluate(() => localStorage.clear());
      await userPage.goto("/login");
      await userPage.locator("#email").fill(email);
      await userPage.locator("#password").fill(password);
      await userPage.getByRole("button", { name: "Entrar" }).click();
      await expect(userPage).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
      await userPage.goto("/contracts");
      await expect(userPage.getByRole("heading", { name: "Contratos" })).toBeVisible();
      await expect(userPage.getByText(/com Contratos: em elaboração/)).toBeVisible(); // fila carregada
    } finally {
      await ctx.close();
      await admin.delete(`/api/users/${user.id}`);
      await admin.dispose();
    }
  });
});
