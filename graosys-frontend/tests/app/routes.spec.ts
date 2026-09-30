import { test, expect } from "../support/fixtures";
import { ROUTES } from "../support/routes";

/** Abre cada tela do app logado como superadmin e confere que carrega sem erro. */
test.describe("Todas as telas carregam", () => {
  for (const route of ROUTES.filter((r) => !r.public)) {
    if (route.path.includes(":")) {
      if (route.pending) test.fixme(`${route.path} — ${route.pending}`, () => {});
      continue; // dinâmicas com coveredBy são testadas no próprio spec
    }

    test(route.path, async ({ page }) => {
      await page.goto(route.path);
      const expected = route.redirectsTo ?? route.path;
      await expect(page).toHaveURL(new RegExp(`${expected.replace(/\//g, "\\/")}$`));
      await expect(page.locator("main")).toBeVisible();
      if (route.heading) {
        await expect(page.locator("main h1").first()).toHaveText(route.heading);
      }
      await page.waitForLoadState("networkidle");
    });
  }
});
