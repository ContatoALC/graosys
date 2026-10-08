import { test, expect } from "../support/fixtures";
import { adminApi, contractPayload, post, uid } from "../support/api";

// "Dados para NFS-e" na Fila da Cobrança: uma nota por parte que paga comissão, tomador do cadastro de clientes,
// campos para copiar no site da prefeitura e registro do número da nota no recebimento.
test.describe("Dados para NFS-e", () => {
  test("mostra tomador e serviço para copiar, avisa cadastro incompleto e registra o número da nota", async ({ page, context }) => {
    test.setTimeout(30_000);
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const id = uid();
    const api = await adminApi();
    const client = await post(api, "/api/clients", {
      name: `Agro Tomadora ${id} Ltda`, nickname: `AT${id}`, kind: "PJ", cnpj_cpf: `12${id}0001`, ins_mun: `IM${id}`,
      address: "Rua das Sementes", number: "100", district: "Centro", city: "Londrina", state: "PR", zip_code: "86010-000",
      contacts: [{ name: "Financeiro", email: `fin.${id}@tomadora.test` }],
    });
    const number = `NF-${id}`;
    // Vendedor do cadastro paga 1% (R$ 1.000); comprador digitado paga R$ 0,50/sc (R$ 500)
    const contract = await post(api, "/api/contracts", contractPayload(number, {
      seller: [client.name], seller_ids: [client.id], buyer: ["Comprador Sem Cadastro"],
      type_commission_buyer: "R$/sc", commission_buyer: "0.50",
    }));
    const receipt = await post(api, "/api/billings", { number_contract: number, number_broker: `B-${number}`, product_name: "Soja E2E", year: "2026", total_service_value: 1000, status: "pending" });

    // A fila da Cobrança só tem contratos já enviados por e-mail (sem servidor de e-mail no teste): simula a lista.
    const queued = await (await api.get(`/api/contracts/${contract.id}`)).json();
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
    await page.route(/\/api\/contracts\?.*department=billing/, async (route) => {
      if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
      await route.fulfill({ headers: cors, json: { data: [{ ...queued, status: { status_current: "Em Cobrança", history: [] }, billing_status: "A Receber", billing_received: 0 }], total: 1 } });
    });

    await page.goto("/billing/receipt");
    await page.getByTestId("billing-queue").getByRole("row", { name: new RegExp(number) }).getByRole("button", { name: "Dados para NFS-e" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: /Dados para NFS-e/ })).toContainText(number);

    // Nota do vendedor: tomador completo do cadastro
    await expect(dialog.getByRole("tab", { name: /Vendedor · R\$ 1\.000,00/ })).toHaveAttribute("aria-selected", "true");
    await expect(dialog.getByTestId("nfse-CNPJ/CPF")).toContainText(`12${id}0001`);
    await expect(dialog.getByTestId("nfse-Cidade/UF")).toContainText("Londrina/PR");
    await expect(dialog.getByTestId("nfse-E-mail")).toContainText(`fin.${id}@tomadora.test`);
    await expect(dialog.getByTestId("nfse-Discriminação")).toContainText(`contrato nº ${number}`);
    await expect(dialog.getByText("Falta no cadastro")).toHaveCount(0);

    // Copiar: o valor vai para a área de transferência no formato da prefeitura
    await dialog.getByRole("button", { name: "Copiar Valor do serviço" }).click();
    await expect(page.getByText("Copiado: Valor do serviço")).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("1.000,00");

    // Nota do comprador: parte digitada sem cadastro → aviso
    await dialog.getByRole("tab", { name: /Comprador · R\$ 500,00/ }).click();
    await expect(dialog.getByTestId("nfse-Nome / Razão social")).toContainText("Comprador Sem Cadastro");
    await expect(dialog).toContainText("Falta no cadastro: cadastro do cliente");
    await expect(dialog.getByTestId("nfse-Discriminação")).toContainText("Comissão devida pelo comprador: R$ 0,50/sc.");

    // Registrar a nota emitida no recebimento
    await dialog.getByLabel("Nº NFS-e").fill(`2026${id}`);
    await dialog.getByLabel("Nº RPS").fill(`R${id}`);
    await dialog.getByRole("button", { name: "Registrar" }).click();
    await expect(page.getByText("Número da nota registrado no recebimento")).toBeVisible();
    const saved = await (await api.get(`/api/billings/${receipt.id}`)).json();
    expect(saved).toMatchObject({ nfs_number: `2026${id}`, rps_number: `R${id}` });
  });

  test("a API devolve uma nota por parte que paga comissão", async () => {
    const api = await adminApi();
    const contract = await post(api, "/api/contracts", contractPayload(`NF-${uid()}`));
    const res = await api.get(`/api/billings/nfse/${contract.id}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.notes).toHaveLength(1); // só o vendedor paga comissão no contrato padrão
    expect(body.notes[0]).toMatchObject({ party: "seller", value: 1000 });
    expect((await api.get("/api/billings/nfse/00000000-0000-0000-0000-000000000000")).status()).toBe(404);
  });
});
