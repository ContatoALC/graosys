import { test, expect } from "../support/fixtures";

test.describe("Login", () => {
  test("redireciona rota privada para /login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("exibe o formulário de login", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "GraoSys" })).toBeVisible();
    await expect(page.getByLabel("E-mail")).toBeVisible();
    await expect(page.getByLabel("Senha")).toBeVisible();
    await expect(page.getByRole("button", { name: "Entrar" })).toBeEnabled();
  });

  test("credenciais inválidas mostram erro e continuam no login", async ({ page }) => {
    test.skip(!process.env.E2E_EMAIL, "precisa do backend rodando");
    await page.goto("/login");
    // E-mail inexistente de propósito: falhas no e-mail real bloqueiam o login (limite de tentativas).
    await page.locator("#email").fill("nao-existe-e2e@graosys.test");
    await page.locator("#password").fill("senha-errada-123");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("button", { name: "Entrar" })).toBeEnabled();
  });

  test("link de esqueci minha senha abre a tela de recuperação", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: /esquec/i }).click();
    await expect(page).toHaveURL(/\/forgot-password$/);
  });
});
