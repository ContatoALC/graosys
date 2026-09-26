import "reflect-metadata";
import path from "path";
import dotenv from "dotenv";
import { DataSource } from "typeorm";
import { entitiesDir } from "../app/entities";
import { withExplicitSslMode } from "./pgUrl";

dotenv.config({ path: ".env" });

// Migrations devem usar conexão direta (não "pooled") do banco: MIGRATION_DATABASE_URL.
const url = withExplicitSslMode(process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL);
const host = process.env.TYPEORM_HOST || "localhost";
const isLocal = !url && ["localhost", "127.0.0.1", "::1"].includes(host);

export const MigrationDataSource = new DataSource({
  type: "postgres",
  ...(url
    ? { url }
    : {
        host,
        port: Number(process.env.TYPEORM_PORT) || 5432,
        username: process.env.TYPEORM_USERNAME || "postgres",
        password: process.env.TYPEORM_PASSWORD || "postgres",
        database: process.env.TYPEORM_DATABASE || "graosys",
      }),
  // Bancos gerenciados (Neon) exigem SSL; MIGRATION_SSL=false só para Postgres sem SSL (CI, Docker).
  ssl: isLocal || process.env.MIGRATION_SSL === "false" ? false : { rejectUnauthorized: false },
  // Entidades só servem para o schema:log (detecção de drift); as migrations são SQL.
  entities: entitiesDir,
  migrations: [path.join(__dirname, "migrations", "*.{ts,js}")],
  migrationsTransactionMode: "each",
  synchronize: false,
  logging: false,
});

