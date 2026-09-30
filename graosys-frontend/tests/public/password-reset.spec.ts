import { test, expect } from "../support/fixtures";

// O caminho feliz precisa do token enviado por e-mail (o banco guarda só o hash), então aqui ficam os casos de erro.
test.describe("Redefinir senha", () => {
  test("sem token mostra link inválido e oferece pedir outro", async ({ page }) => {
    await page.goto("/reset-password");
    await expect(page.getByText("Link inválido")).toBeVisible();
    await page.getByRole("link", { name: "Pedir um novo link" }).click();
    await expect(page).toHaveURL(/\/forgot-password$/);
  });

  test("senhas diferentes não são enviadas", async ({ page }) => {
    await page.goto("/reset-password?token=qualquer");
    await expect(page.getByText("Criar nova senha")).toBeVisible();
    await page.getByLabel("Nova senha", { exact: true }).fill("Senha-Nova-123");
    await page.getByLabel("Confirme a nova senha").fill("Senha-Outra-123");
    await page.getByRole("button", { name: "Salvar nova senha" }).click();
    await expect(page.getByText("As senhas não conferem.")).toBeVisible();
  });

  test("token inválido mostra o erro da API e continua na tela", async ({ page }) => {
    test.skip(!process.env.E2E_EMAIL, "precisa do backend rodando");
    await page.goto("/reset-password?token=token-invalido-e2e");
    await page.getByLabel("Nova senha", { exact: true }).fill("Senha-Nova-123");
    await page.getByLabel("Confirme a nova senha").fill("Senha-Nova-123");
    await page.getByRole("button", { name: "Salvar nova senha" }).click();
    await expect(page.getByText(/Link inválido ou expirado/)).toBeVisible();
    await expect(page).toHaveURL(/\/reset-password/);
  });
});
