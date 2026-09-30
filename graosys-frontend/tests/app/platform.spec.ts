import { test, expect } from "../support/fixtures";

test.describe("Plataforma (superadmin)", () => {
  test("abre o detalhe de uma corretora", async ({ page }) => {
    await page.goto("/platform");
    const firstTenant = page.locator('a[href^="/platform/tenants/"]').first();
    await expect(firstTenant).toBeVisible();
    await firstTenant.click();
    await expect(page).toHaveURL(/\/platform\/tenants\/[\w-]+$/);
    await expect(page.locator("main")).toBeVisible();
    await page.waitForLoadState("networkidle");
  });
});
