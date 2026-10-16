import type { Locator, Page } from "@playwright/test";

/**
 * Escolhe uma opção num Select do shadcn (Radix): abre pelo gatilho e clica na opção pelo texto.
 * No lugar de `locator.selectOption(...)`, que só serve para o <select> nativo.
 */
export async function choose(page: Page, trigger: Locator, option: string | RegExp) {
  await trigger.click();
  await page.getByRole("option", { name: option, exact: typeof option === "string" }).click();
}
