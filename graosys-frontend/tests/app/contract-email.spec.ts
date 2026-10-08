import { test, expect } from "../support/fixtures";
import { adminApi, approvedContract, post, uid } from "../support/api";

// Envio do contrato por e-mail: os grupos de destinatários de vendedor e comprador são digitados na
// própria tela de envio (a parte não precisa estar no cadastro de clientes) e ficam gravados no contrato.
test.describe("Envio de contrato por e-mail", () => {
  test("destinatários digitados na tela de envio ficam gravados no contrato", async ({ page }) => {
    test.setTimeout(20_000); // abre o diálogo duas vezes
    const number = `MAIL-${uid()}`;
    const api = await adminApi();
    const contract = await approvedContract(api, number, { seller: ["Vendedor sem cadastro"], buyer: ["Comprador sem cadastro"] });

    // O disparo em si é simulado: o ambiente de teste não tem servidor de e-mail.
    let sendBody: any = null;
    // A API fica em outra origem, então a resposta simulada precisa dos cabeçalhos de CORS (inclusive no preflight).
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
    await page.route("**/api/email/send-contract", async (route) => {
      if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
      sendBody = route.request().postDataJSON();
      await route.fulfill({ headers: cors, json: { message: "E-mails enviados com sucesso!", sent_to: ["a", "b", "c"], results: [] } });
    });

    const open = async () => {
      await page.goto("/execution");
      await page.getByPlaceholder("Buscar contrato...").fill(number);
      await page.getByPlaceholder("Buscar contrato...").press("Enter");
      await page.getByRole("row", { name: new RegExp(number) }).getByTitle("Enviar contrato por e-mail").click();
      return page.getByRole("dialog");
    };

    let dialog = await open();
    const send = dialog.getByRole("button", { name: "Enviar agora" });
    await expect(dialog.getByLabel("E-mails do vendedor")).toHaveValue("");
    await expect(send).toBeDisabled(); // sem nenhum e-mail não há o que enviar

    // E-mail inválido não é gravado nem enviado
    await dialog.getByLabel("E-mails do vendedor").fill("Financeiro@Vendedor.test, logistica@vendedor.test");
    await dialog.getByLabel("E-mails do comprador").fill("compras@comprador.test\nnao-e-email");
    await send.click();
    await expect(dialog.getByText("E-mail inválido: nao-e-email")).toBeVisible();
    expect(sendBody).toBeNull();

    await dialog.getByLabel("E-mails do comprador").fill("compras@comprador.test; compras@comprador.test");
    await send.click();
    await expect(dialog.getByText("E-mails enviados com sucesso!")).toBeVisible();
    expect(sendBody).toMatchObject({ contract_id: contract.id });

    // Gravado no contrato: minúsculas, sem repetidos, cada grupo na sua parte
    const saved = await (await api.get(`/api/contracts/${contract.id}`)).json();
    expect(saved.list_email_seller).toEqual(["financeiro@vendedor.test", "logistica@vendedor.test"]);
    expect(saved.list_email_buyer).toEqual(["compras@comprador.test"]);

    // Ao reabrir, os grupos já vêm preenchidos
    dialog = await open();
    await expect(dialog.getByLabel("E-mails do vendedor")).toHaveValue("financeiro@vendedor.test\nlogistica@vendedor.test");
    await expect(dialog.getByLabel("E-mails do comprador")).toHaveValue("compras@comprador.test");

    // A API também valida (não depende da tela)
    const bad = await api.put(`/api/contracts/${contract.id}/email-recipients`, { data: { seller: ["sem-arroba"], buyer: [] } });
    expect(bad.status()).toBe(400);
    await api.dispose();
  });

  test("e-mails do cadastro do cliente entram no contrato e na tela de envio", async ({ page }) => {
    test.setTimeout(30_000); // cadastro de cliente + contrato + diálogo de envio
    const id = uid();
    const client = `Cliente Mail ${id}`;
    const api = await adminApi();
    await post(api, "/api/products", { product_type: `ML${id}`, name: `Produto Mail ${id}` });

    // Cadastro: seção de e-mails para envio de contratos
    await page.goto("/clients/new");
    await page.locator('input[name="name"]').fill(client);
    await page.locator('input[name="nickname"]').fill(`ML${id}`);
    await page.locator('input[name="cnpj_cpf"]').fill(`333${id}`); // 11 dígitos: sem consulta de CNPJ
    await page.getByRole("button", { name: "Adicionar e-mail" }).click();
    await page.locator('input[name="contacts.0.name"]').fill("Financeiro");
    await page.locator('input[name="contacts.0.email"]').fill(`Fin.${id}@cliente.test`);
    await page.getByRole("button", { name: "Adicionar e-mail" }).click();
    await page.locator('input[name="contacts.1.email"]').fill(`contratos.${id}@cliente.test`);
    await page.getByRole("button", { name: "Cadastrar Cliente" }).click();
    await expect(page).toHaveURL(/\/clients$/);

    const found = await (await api.get(`/api/clients?search=${encodeURIComponent(client)}`)).json();
    const saved = found.data[0];
    expect(saved.contacts).toEqual([{ name: "Financeiro", email: `fin.${id}@cliente.test` }, { email: `contratos.${id}@cliente.test` }]);

    // Contrato: escolher o cliente como vendedor traz os e-mails dele
    await page.goto("/contracts/new");
    await page.getByPlaceholder("Buscar ou digitar o vendedor").fill(client);
    await page.getByRole("button", { name: new RegExp(client) }).click();
    await expect(page.locator('input[name="list_email_seller.0.value"]')).toHaveValue(`fin.${id}@cliente.test`);
    await expect(page.locator('input[name="list_email_seller.1.value"]')).toHaveValue(`contratos.${id}@cliente.test`);
    // Escolher de novo não duplica
    await page.getByPlaceholder("Buscar ou digitar o vendedor").fill(client);
    await page.getByRole("button", { name: new RegExp(client) }).click();
    await expect(page.locator('input[name^="list_email_seller."]')).toHaveCount(2);

    // Tela de envio: contrato antigo, vinculado ao cliente mas sem e-mails, recebe a sugestão do cadastro
    const number = `MAILC-${id}`;
    await approvedContract(api, number, { seller: ["Vendedor sem cadastro"], buyer: [client], buyer_ids: [saved.id] });
    await page.goto("/execution");
    await page.getByPlaceholder("Buscar contrato...").fill(number);
    await page.getByPlaceholder("Buscar contrato...").press("Enter");
    await page.getByRole("row", { name: new RegExp(number) }).getByTitle("Enviar contrato por e-mail").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("E-mails do comprador")).toHaveValue(`fin.${id}@cliente.test\ncontratos.${id}@cliente.test`);
    await expect(dialog.getByLabel("E-mails do vendedor")).toHaveValue("");
    await expect(dialog.getByText("vieram do cadastro de clientes")).toBeVisible();

    // E-mail inválido no cadastro é recusado pela API
    const bad = await api.patch(`/api/clients/${saved.id}`, { data: { contacts: [{ name: "X", email: "sem-arroba" }] } });
    expect(bad.status()).toBe(400);
    await api.dispose();
  });
});
