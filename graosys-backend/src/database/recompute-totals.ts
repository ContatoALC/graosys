import "reflect-metadata";
import { AppDataSource, initializeDataSource } from "./data-source";
import { GrainContract } from "../app/entities/GrainContract";
import { applyTotals } from "../services/contractTotals";

// Recalcula quantidade em kg, valor total e comissões dos contratos que ainda não têm esses valores
// (criados antes de o servidor calcular). Idempotente. Uso: npm run recompute:totals
async function run() {
  await initializeDataSource(3, 1000);
  const repo = AppDataSource.getRepository(GrainContract);
  const contracts = await repo.find();
  let changed = 0;
  for (const c of contracts) {
    const before = JSON.stringify([c.quantity_kg, c.total_contract_value, c.commission_contract]);
    applyTotals(c);
    if (JSON.stringify([c.quantity_kg, c.total_contract_value, c.commission_contract]) !== before) { await repo.save(c); changed++; }
  }
  console.log(`Contratos analisados: ${contracts.length}, atualizados: ${changed}`);
}

run().then(() => AppDataSource.destroy()).catch(async (e) => { console.error(e); if (AppDataSource.isInitialized) await AppDataSource.destroy(); process.exit(1); });
