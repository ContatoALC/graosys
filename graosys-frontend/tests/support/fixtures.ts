import { test as base, expect } from "@playwright/test";

/**
 * `test` com vigia automático: qualquer erro JS não tratado na página ou
 * resposta 5xx da API faz o teste falhar, mesmo que a tela "pareça" certa.
 */
export const test = base.extend<{ guard: void }>({
  guard: [
    async ({ page }, use, testInfo) => {
      const problems: string[] = [];
      page.on("pageerror", (err) => problems.push(`Erro JS: ${err.message}`));
      page.on("response", (res) => {
        if (res.url().includes("/api/") && res.status() >= 500) {
          problems.push(`API ${res.status()}: ${res.request().method()} ${res.url()}`);
        }
      });
      await use();
      if (problems.length) {
        await testInfo.attach("problemas", { body: problems.join("\n"), contentType: "text/plain" });
      }
      expect(problems, "Erros capturados durante o teste").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
