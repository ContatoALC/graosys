// Roda as migrations no build de PRODUÇÃO da Vercel. Previews e builds locais não migram.
// Se a migration falhar, o build falha e a versão anterior continua no ar.
const { execSync } = require("child_process");

const env = process.env.VERCEL_ENV;
if (env !== "production") {
  console.log(`[migrate] VERCEL_ENV=${env || "(vazio)"}: migrations ignoradas (apenas production migra).`);
  process.exit(0);
}
if (!process.env.MIGRATION_DATABASE_URL && !process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
  console.error("[migrate] Nenhuma URL de banco definida (MIGRATION_DATABASE_URL, DATABASE_URL ou POSTGRES_URL).");
  process.exit(1);
}
console.log("[migrate] Executando migrations em produção...");
execSync("npm run migration:run", { stdio: "inherit" });
console.log("[migrate] Migrations concluídas.");
