import "reflect-metadata";
import fs from "fs";
import path from "path";
import { AppDataSource, initializeDataSource } from "./data-source";
import { Lead } from "../app/entities/Lead";

// Dados dos leads ficam em seed-leads.data.json (ignorado pelo git: contém contatos e estratégia comerciais).
const DATA_FILE = path.join(__dirname, "seed-leads.data.json");
const LEADS: Partial<Lead>[] = fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) : [];

async function run() {
  if (LEADS.length === 0) { console.log("Nenhum lead: crie src/database/seed-leads.data.json (array de leads)."); return; }
  await initializeDataSource(3, 1000);
  const repo = AppDataSource.getRepository(Lead);
  for (const l of LEADS) {
    if (await repo.findOne({ where: { name: l.name } })) { console.log(`Já existe: ${l.name}`); continue; }
    await repo.save(repo.create({ status: "a_contatar", ...l }));
    console.log(`Lead criado: ${l.name}`);
  }
}

run()
  .then(() => AppDataSource.destroy())
  .catch(async (e) => { console.error(e); if (AppDataSource.isInitialized) await AppDataSource.destroy(); process.exit(1); });
