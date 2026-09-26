import "reflect-metadata";
import dotenv from "dotenv";
import { DataSource } from "typeorm";
import { entitiesDir } from "../app/entities";
import { withExplicitSslMode } from "./pgUrl";

dotenv.config({ path: ".env" });

// Nunca sincroniza schema na Vercel/produção (pode dropar colunas com dados);
// para forçar, defina TYPEORM_SYNCHRONIZE=true.
const SYNCHRONIZE =
  process.env.TYPEORM_SYNCHRONIZE === "true" ||
  (process.env.NODE_ENV !== "production" && !process.env.VERCEL);

const SSL_VALUE = { rejectUnauthorized: false };
const dbHost = process.env.TYPEORM_HOST || "localhost";
const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(dbHost);

// Vercel Postgres / Neon / Supabase expõem uma connection string pronta
// (DATABASE_URL ou POSTGRES_URL). Se existir, ela tem prioridade sobre as
// variáveis TYPEORM_* usadas no ambiente local.
const connectionString = withExplicitSslMode(process.env.DATABASE_URL || process.env.POSTGRES_URL);

export const AppDataSource = new DataSource(
  connectionString
    ? {
        type: "postgres",
        url: connectionString,
        synchronize: SYNCHRONIZE,
        logging: false,
        entities: entitiesDir,
        ssl: SSL_VALUE,
        extra: {
          // Ambiente serverless: cada invocação pode abrir sua própria
          // conexão, então mantemos o pool pequeno para não estourar o
          // limite de conexões do banco.
          max: 5,
          min: 0,
          connectionTimeoutMillis: 30000,
          idleTimeoutMillis: 30000,
        },
      }
    : {
        type: "postgres",
        host: dbHost,
        port: Number(process.env.TYPEORM_PORT) || 5432,
        username: process.env.TYPEORM_USERNAME || "postgres",
        password: process.env.TYPEORM_PASSWORD || "postgres",
        database: process.env.TYPEORM_DATABASE || "graosys",
        synchronize: SYNCHRONIZE,
        logging: false,
        entities: entitiesDir,
        // Host remoto (Neon etc.) sempre com SSL; local só se TYPEORM_SSL=true.
        ssl: !isLocalHost || process.env.TYPEORM_SSL === "true" ? SSL_VALUE : false,
        extra: {
          max: 20,
          min: 2,
          connectionTimeoutMillis: 30000,
          idleTimeoutMillis: 30000,
        },
      }
);

export async function initializeDataSource(maxRetries = 5, delayMs = 3000) {
  if (AppDataSource.isInitialized) {
    return true;
  }
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Conectando ao banco (tentativa ${attempt}/${maxRetries})...`);
      await AppDataSource.initialize();
      console.log("✅ Banco de dados conectado!");
      return true;
    } catch (error) {
      lastError = error as Error;
      console.error(`❌ Falha na tentativa ${attempt}:`, (error as Error).message);
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
      }
    }
  }
  throw lastError;
}
