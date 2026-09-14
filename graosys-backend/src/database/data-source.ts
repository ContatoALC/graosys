import "reflect-metadata";
import dotenv from "dotenv";
import { DataSource } from "typeorm";
import { entitiesDir } from "../app/entities";

dotenv.config({ path: ".env" });

const SSL_VALUE = process.env.TYPEORM_SSL === "false" ? false : { rejectUnauthorized: false };

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.TYPEORM_HOST || "localhost",
  port: Number(process.env.TYPEORM_PORT) || 5432,
  username: process.env.TYPEORM_USERNAME || "postgres",
  password: process.env.TYPEORM_PASSWORD || "postgres",
  database: process.env.TYPEORM_DATABASE || "graosys",
  synchronize: process.env.NODE_ENV !== "production",
  logging: false,
  entities: entitiesDir,
  migrations: ["src/database/migrations/*.ts"],
  ssl: process.env.NODE_ENV === "production" ? SSL_VALUE : false,
  extra: {
    max: 20,
    min: 2,
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
  },
});

export async function initializeDataSource(maxRetries = 5, delayMs = 3000) {
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
