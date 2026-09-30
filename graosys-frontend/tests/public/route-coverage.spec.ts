import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";
import { ROUTES } from "../support/routes";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * Trava de segurança: toda rota do Routes.tsx precisa estar em
 * tests/support/routes.ts. Criou tela nova sem registrar/testar → CI falha.
 */
function routesFromSource(): string[] {
  const src = readFileSync(join(ROOT, "src/Routes.tsx"), "utf8");
  const paths: string[] = [];
  for (const m of src.matchAll(/<Route\s+(index|path="([^"]+)")/g)) {
    if (m[1] === "index") continue; // index = "/"
    const p = m[2];
    if (p === "*") continue;
    paths.push(p.startsWith("/") ? p : `/${p}`);
  }
  return [...new Set(paths)];
}

test("toda rota do Routes.tsx está registrada nos testes", () => {
  const registered = new Set(ROUTES.map((r) => r.path));
  const missing = routesFromSource().filter((p) => !registered.has(p));
  expect(missing, "Rotas sem teste — adicione em tests/support/routes.ts").toEqual([]);
});

test("nenhuma rota registrada deixou de existir", () => {
  const existing = new Set([...routesFromSource(), "/"]);
  const stale = ROUTES.map((r) => r.path).filter((p) => !existing.has(p));
  expect(stale, "Rotas removidas do app — tire de tests/support/routes.ts").toEqual([]);
});

test("rotas dinâmicas têm spec ou pendência declarada", () => {
  const orphan = ROUTES.filter((r) => r.path.includes(":") && !r.coveredBy && !r.pending).map((r) => r.path);
  expect(orphan).toEqual([]);
});

test("specs citados em coveredBy existem", () => {
  for (const r of ROUTES.filter((r) => r.coveredBy)) {
    expect(() => readFileSync(join(ROOT, r.coveredBy!)), `${r.path} → ${r.coveredBy}`).not.toThrow();
  }
});
