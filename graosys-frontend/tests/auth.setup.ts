import { test as setup, expect } from "@playwright/test";

export const AUTH_FILE = "playwright/.auth/superadmin.json";

setup("login como superadmin", async ({ page }) => {
  setup.setTimeout(60_000); // primeira carga do Vite pode demorar
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) {
    throw new Error("Defina E2E_EMAIL e E2E_PASSWORD (arquivo graosys-frontend/.env.e2e). Veja tests/README.md.");
  }

  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  await page.context().storageState({ path: AUTH_FILE });
});
