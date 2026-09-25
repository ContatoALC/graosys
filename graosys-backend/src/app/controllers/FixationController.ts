import { Request, Response } from "express";
import { AppDataSource } from "../../database/data-source";
import { GrainContract } from "../entities/GrainContract";
import { ContractFixation } from "../entities/ContractFixation";
import { framePrice, round } from "../../services/pricing";
import { applyTotals } from "../../services/contractTotals";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));
const EPS = 1e-6;

export function fixationSummary(contract: GrainContract, fixations: ContractFixation[]) {
  const total = Number(contract.quantity || 0);
  const fixed = fixations.reduce((s, f) => s + Number(f.quantity), 0);
  const value = fixations.reduce((s, f) => s + Number(f.quantity) * Number(f.price), 0);
  return {
    contract_quantity: total,
    fixed_quantity: round(fixed),
    balance: round(Math.max(0, total - fixed)),
    progress: total > 0 ? Math.min(1, fixed / total) : 0,
    average_price: fixed > 0 ? round(value / fixed) : null,
    fixed_value: round(value),
    status: fixed <= EPS ? "waiting" : fixed + EPS >= total ? "fixed" : "partial",
  };
}

// Recalcula o contrato a partir das fixações (preço médio, quantidade fixada, valor e comissões).
async function recompute(contract: GrainContract, fixations: ContractFixation[]) {
  const s = fixationSummary(contract, fixations);
  contract.fixed_quantity = s.fixed_quantity;
  contract.price = s.average_price ?? 0;
  applyTotals(contract, s.fixed_value);
}

async function loadContract(req: Request, res: Response, repo = AppDataSource.getRepository(GrainContract)) {
  const contract = await repo.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });
  if (!contract) { res.status(404).json({ error: "Contrato não encontrado" }); return null; }
  return contract;
}

export class FixationController {
  async list(req: Request, res: Response) {
    const contract = await loadContract(req, res);
    if (!contract) return;
    const fixations = await AppDataSource.getRepository(ContractFixation).find({
      where: { tenant_id: req.user.tenant_id, contract_id: contract.id },
      order: { fixation_date: "ASC", created_at: "ASC" },
    });
    return res.json({ fixations, summary: fixationSummary(contract, fixations) });
  }

  async create(req: Request, res: Response) {
    const { tenant_id } = req.user;
    const b = req.body || {};

    const result = await AppDataSource.transaction(async (tx) => {
      // Serializa fixações do mesmo contrato para não ultrapassar o saldo em requisições simultâneas.
      await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`fixation:${req.params.id}`]);
      const contractRepo = tx.getRepository(GrainContract);
      const fixRepo = tx.getRepository(ContractFixation);

      const contract = await contractRepo.findOne({ where: { id: req.params.id, tenant_id } });
      if (!contract) return { status: 404, error: "Contrato não encontrado" } as const;
      if (contract.price_type !== "to_fix") return { status: 400, error: "Este contrato não é a fixar" } as const;

      const existing = await fixRepo.find({ where: { tenant_id, contract_id: contract.id } });
      const summary = fixationSummary(contract, existing);

      const quantity = Number(b.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) return { status: 400, error: "Informe uma quantidade maior que zero" } as const;
      if (quantity > summary.balance + EPS) return { status: 400, error: `Quantidade maior que o saldo a fixar (${summary.balance})` } as const;
      if (!b.fixation_date || !DATE_RE.test(String(b.fixation_date))) return { status: 400, error: "Data da fixação inválida" } as const;

      let chicago: number | null = null, premium: number | null = null, exchange: number | null = null, price: number;
      if (contract.fixation_mode === "market") {
        price = Number(b.price);
        if (!Number.isFinite(price) || price <= 0) return { status: 400, error: "Informe o preço de mercado da fixação" } as const;
      } else {
        // Frame: componente já travado no contrato prevalece; os demais vêm da fixação. O preço é sempre calculado aqui.
        chicago = contract.frame_chicago !== null ? Number(contract.frame_chicago) : num(b.chicago);
        premium = contract.frame_premium !== null ? Number(contract.frame_premium) : num(b.premium);
        exchange = contract.type_currency === "USD" ? null : contract.frame_exchange !== null ? Number(contract.frame_exchange) : num(b.exchange_rate);
        if (chicago === null || !(chicago > 0)) return { status: 400, error: "Informe o valor de Chicago (c/bu)" } as const;
        if (premium === null || !Number.isFinite(premium)) return { status: 400, error: "Informe o prêmio (c/bu)" } as const;
        if (contract.type_currency !== "USD" && (exchange === null || !(exchange > 0))) return { status: 400, error: "Informe o câmbio (R$/US$)" } as const;
        price = framePrice({ chicago, premium, exchange }, { product: contract.name_product, unit: contract.type_quantity, currency: contract.type_currency });
      }

      const fixation = await fixRepo.save(fixRepo.create({
        tenant_id, contract_id: contract.id, fixation_date: String(b.fixation_date), quantity: round(quantity), mode: contract.fixation_mode || "frame",
        chicago, premium, exchange_rate: exchange, price, notes: b.notes ? String(b.notes).slice(0, 255) : null,
        created_by_id: req.user.id, created_by_name: req.user.name,
      }));
      await recompute(contract, [...existing, fixation]);
      await contractRepo.save(contract);
      return { status: 201, fixation, contract, summary: fixationSummary(contract, [...existing, fixation]) } as const;
    });

    if ("error" in result) return res.status(result.status).json({ error: result.error });
    return res.status(201).json({ fixation: result.fixation, summary: result.summary, contract: result.contract });
  }

  async remove(req: Request, res: Response) {
    const { tenant_id } = req.user;
    const result = await AppDataSource.transaction(async (tx) => {
      await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`fixation:${req.params.id}`]);
      const contractRepo = tx.getRepository(GrainContract);
      const fixRepo = tx.getRepository(ContractFixation);
      const contract = await contractRepo.findOne({ where: { id: req.params.id, tenant_id } });
      if (!contract) return null;
      const target = await fixRepo.findOne({ where: { id: req.params.fixationId, contract_id: contract.id, tenant_id } });
      if (!target) return null;
      await fixRepo.remove(target);
      const rest = await fixRepo.find({ where: { tenant_id, contract_id: contract.id } });
      await recompute(contract, rest);
      await contractRepo.save(contract);
      return { contract, summary: fixationSummary(contract, rest) };
    });
    if (!result) return res.status(404).json({ error: "Fixação não encontrada" });
    return res.json(result);
  }
}
