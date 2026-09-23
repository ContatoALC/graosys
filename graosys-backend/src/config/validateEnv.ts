const INSECURE_JWT_SECRETS = new Set([
  "secret",
  "your-super-secret-key-change-in-production",
]);

const INSECURE_DB_PASSWORDS = new Set(["postgres", "password", "mypassword"]);

export function validateEnv() {
  if (process.env.NODE_ENV !== "production") return;

  const errors: string[] = [];

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.length < 32 || INSECURE_JWT_SECRETS.has(jwtSecret)) {
    errors.push("JWT_SECRET ausente, curto (mínimo 32 caracteres) ou igual a um valor padrão inseguro.");
  }

  if (!process.env.EMAIL_ENCRYPTION_KEY || process.env.EMAIL_ENCRYPTION_KEY.length < 32) {
    console.warn("EMAIL_ENCRYPTION_KEY ausente ou curta (mínimo 32 caracteres): cadastro de SMTP por corretora ficará indisponível.");
  }

  const hasConnectionString = Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL);
  if (!hasConnectionString) {
    const dbPassword = process.env.TYPEORM_PASSWORD;
    if (!dbPassword || INSECURE_DB_PASSWORDS.has(dbPassword)) {
      errors.push("TYPEORM_PASSWORD ausente ou igual a um valor padrão inseguro (ex.: 'postgres').");
    }
    if (!process.env.TYPEORM_USERNAME || process.env.TYPEORM_USERNAME === "postgres") {
      errors.push("TYPEORM_USERNAME ausente ou usando o usuário padrão 'postgres' em produção.");
    }
  }

  if (errors.length > 0) {
    throw new Error(
      "Configuração insegura detectada em produção:\n" + errors.map((e) => `  - ${e}`).join("\n")
    );
  }
}
