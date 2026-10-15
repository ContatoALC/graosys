import type { APIRequestContext } from "@playwright/test";
import { expect } from "@playwright/test";

/** Texto de um PDF (todas as páginas), com espaços normalizados, para conferir o conteúdo gerado. */
export async function pdfText(data: Buffer): Promise<string> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await getDocument({ data: new Uint8Array(data), isEvalSupported: false, verbosity: 0 }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
  }
  await doc.destroy();
  return pages.join(" ").replace(/\s+/g, " ");
}

/** PDF do contrato pela API (a mesma rota do botão "Ver PDF"): nome do arquivo e texto. */
export async function contractPdf(api: APIRequestContext, contractId: string, role: "Vendedor" | "Comprador" = "Vendedor") {
  const res = await api.get(`/api/contracts/${contractId}/pdf?role=${role}`);
  expect(res.status(), await res.text().catch(() => "")).toBe(200);
  return { filename: res.headers()["content-disposition"] ?? "", text: await pdfText(await res.body()) };
}
