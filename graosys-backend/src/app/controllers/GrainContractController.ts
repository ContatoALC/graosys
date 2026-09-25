import { Request, Response } from "express";
import { AppDataSource } from "../../database/data-source";
import { GrainContract } from "../entities/GrainContract";
import { ILike } from "typeorm";
import { pickFields } from "../../utils/pickFields";
import { nextContractNumber } from "../../utils/contractNumber";
import { applyTotals } from "../../services/contractTotals";
import { ContractFixation } from "../entities/ContractFixation";

const ALLOWED_FIELDS: (keyof GrainContract)[] = [
  "number_broker", "number_contract", "seller", "buyer", "list_email_seller", "list_email_buyer",
  "product", "name_product", "crop", "quality", "type_quantity", "quantity", "quantity_kg",
  "quantity_bag", "type_currency", "price", "type_icms", "icms", "payment",
  "type_commission_seller", "commission_seller", "type_commission_buyer", "commission_buyer",
  "type_pickup", "pickup", "pickup_location", "inspection", "observation",
  "internal_communication", "destination", "complement_destination",
  "number_external_contract_buyer", "number_external_contract_seller", "day_exchange_rate",
  "payment_date", "initial_pickup_date", "final_pickup_date", "contract_emission_date",
  "owner_contract", "total_contract_value", "commission_contract",
  "commission_seller_contract_value", "commission_buyer_contract_value", "total_received",
  "status_received", "expected_receipt_date", "table_id",
  "price_type", "fixation_mode", "cbot_reference", "fixation_deadline", "frame_chicago", "frame_premium", "frame_exchange",
];

const PRICE_TYPES = ["fixed", "to_fix"];
const FIXATION_MODES = ["market", "frame"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Regras do contrato a fixar; devolve mensagem de erro ou null.
function validatePricing(c: Partial<GrainContract>): string | null {
  if (c.price_type !== undefined && !PRICE_TYPES.includes(c.price_type)) return "Tipo de preço inválido";
  if (c.price_type === "to_fix") {
    if (!c.fixation_mode || !FIXATION_MODES.includes(c.fixation_mode)) return "Informe a modalidade de fixação (Mercado ou Frame)";
    if (!c.fixation_deadline || !DATE_RE.test(String(c.fixation_deadline))) return "Informe o prazo para fixação";
  }
  return null;
}

// Vazios viram nulo e contratos de preço fixo não carregam dados de fixação.
function normalizePricing(c: GrainContract) {
  for (const k of ["frame_chicago", "frame_premium", "frame_exchange"] as const) {
    if ((c[k] as unknown) === "" || c[k] === undefined) (c as any)[k] = null;
  }
  if (c.price_type !== "to_fix") {
    c.price_type = "fixed"; c.fixation_mode = null; c.cbot_reference = null; c.fixation_deadline = null;
    c.frame_chicago = null; c.frame_premium = null; c.frame_exchange = null; c.fixed_quantity = 0;
  } else if (c.price === undefined || c.price === null || (c.price as unknown) === "") {
    c.price = 0;
  }
}

export class GrainContractController {
  async create(req: Request, res: Response) {
    const contractRepo = AppDataSource.getRepository(GrainContract);
    const input = pickFields<GrainContract>(req.body, ALLOWED_FIELDS);
    const pricingError = validatePricing(input);
    if (pricingError) return res.status(400).json({ error: pricingError });
    const contract = contractRepo.create({
      ...input,
      tenant_id: req.user.tenant_id,
      status: {
        status_current: "Ativo",
        history: [{ date: new Date().toLocaleDateString("pt-BR"), time: new Date().toLocaleTimeString("pt-BR"), status: "Ativo", owner_change: req.user.name }],
      },
    });
    normalizePricing(contract);
    contract.fixed_quantity = 0;
    applyTotals(contract);
    await contractRepo.save(contract);
    return res.status(201).json(contract);
  }

  // Clona um contrato da própria corretora; o número é o do último contrato da base + 1.
  async clone(req: Request, res: Response) {
    const { tenant_id } = req.user;
    const clone = await AppDataSource.transaction(async (tx) => {
      const repo = tx.getRepository(GrainContract);
      // Serializa clonagens do mesmo tenant para não gerar números duplicados.
      await tx.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`contract-number:${tenant_id}`]);

      const source = await repo.findOne({ where: { id: req.params.id, tenant_id } });
      if (!source) return null;

      const last = await repo.findOne({ where: { tenant_id }, order: { created_at: "DESC" }, select: ["id", "number_contract"] });
      let number = nextContractNumber(last?.number_contract);
      for (let i = 0; i < 100 && (await repo.count({ where: { tenant_id, number_contract: number } })) > 0; i++) {
        number = nextContractNumber(number);
      }

      const now = new Date();
      const draft = repo.create({
          ...pickFields<GrainContract>(source, ALLOWED_FIELDS),
          tenant_id,
          number_contract: number,
          contract_emission_date: now.toISOString().slice(0, 10),
          number_external_contract_buyer: null,
          number_external_contract_seller: null,
          total_received: null,
          status_received: null,
          fixed_quantity: 0,
          ...(source.price_type === "to_fix" ? { price: 0, total_contract_value: 0 } : {}),
          expected_receipt_date: null,
          status: {
            status_current: "Ativo",
            history: [{ date: now.toLocaleDateString("pt-BR"), time: now.toLocaleTimeString("pt-BR"), status: "Ativo", owner_change: req.user.name }],
          },
        });
      applyTotals(draft);
      return repo.save(draft);
    });
    if (!clone) return res.status(404).json({ error: "Contrato não encontrado" });
    return res.status(201).json(clone);
  }

  async getAll(req: Request, res: Response) {
    const { search, crop, product, page = "1", limit = "50" } = req.query;
    const contractRepo = AppDataSource.getRepository(GrainContract);

    const where: any = { tenant_id: req.user.tenant_id };
    if (crop) where.crop = crop;
    if (product) where.product = product;
    if (search) where.number_contract = ILike(`%${search}%`);

    const [contracts, total] = await contractRepo.findAndCount({
      where,
      order: { created_at: "DESC" },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    });

    return res.json({ data: contracts, total, page: Number(page), limit: Number(limit) });
  }

  async getById(req: Request, res: Response) {
    const contractRepo = AppDataSource.getRepository(GrainContract);
    const contract = await contractRepo.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });
    if (!contract) return res.status(404).json({ error: "Contrato não encontrado" });
    return res.json(contract);
  }

  async update(req: Request, res: Response) {
    const contractRepo = AppDataSource.getRepository(GrainContract);
    const contract = await contractRepo.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });
    if (!contract) return res.status(404).json({ error: "Contrato não encontrado" });
    const input = pickFields<GrainContract>(req.body, ALLOWED_FIELDS);
    const pricingError = validatePricing({ ...contract, ...input });
    if (pricingError) return res.status(400).json({ error: pricingError });

    // Com fixações lançadas, o modo de preço e a quantidade não podem contradizê-las.
    const fixationCount = await AppDataSource.getRepository(ContractFixation).count({ where: { contract_id: contract.id, tenant_id: req.user.tenant_id } });
    if (fixationCount > 0) {
      if (input.price_type !== undefined && input.price_type !== contract.price_type) return res.status(400).json({ error: "Não é possível mudar o tipo de preço: há fixações lançadas. Exclua-as antes." });
      if (input.fixation_mode !== undefined && input.fixation_mode !== contract.fixation_mode) return res.status(400).json({ error: "Não é possível mudar a modalidade: há fixações lançadas." });
      if (input.quantity !== undefined && Number(input.quantity) + 1e-6 < Number(contract.fixed_quantity)) return res.status(400).json({ error: "A quantidade não pode ser menor que a já fixada." });
      delete (input as any).price; // o preço de um contrato a fixar vem das fixações
    }

    Object.assign(contract, input);
    normalizePricing(contract);
    applyTotals(contract);
    await contractRepo.save(contract);
    return res.json(contract);
  }

  async updateStatus(req: Request, res: Response) {
    const { status } = req.body;
    const contractRepo = AppDataSource.getRepository(GrainContract);
    const contract = await contractRepo.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });
    if (!contract) return res.status(404).json({ error: "Contrato não encontrado" });

    const now = new Date();
    const historyEntry = {
      date: now.toLocaleDateString("pt-BR"),
      time: now.toLocaleTimeString("pt-BR"),
      status,
      owner_change: req.user.name,
    };

    contract.status = {
      status_current: status,
      history: [...(contract.status?.history || []), historyEntry],
    };

    await contractRepo.save(contract);
    return res.json(contract);
  }

  async delete(req: Request, res: Response) {
    const contractRepo = AppDataSource.getRepository(GrainContract);
    const contract = await contractRepo.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });
    if (!contract) return res.status(404).json({ error: "Contrato não encontrado" });
    await contractRepo.remove(contract);
    return res.status(204).send();
  }

  async getReport(req: Request, res: Response) {
    const contractRepo = AppDataSource.getRepository(GrainContract);
    const { crop, product, start_date, end_date } = req.query;

    const qb = contractRepo.createQueryBuilder("c")
      .where("c.tenant_id = :tenant_id", { tenant_id: req.user.tenant_id });

    if (crop) qb.andWhere("c.crop = :crop", { crop });
    if (product) qb.andWhere("c.product = :product", { product });
    if (start_date) qb.andWhere("c.contract_emission_date >= :start_date", { start_date });
    if (end_date) qb.andWhere("c.contract_emission_date <= :end_date", { end_date });

    const contracts = await qb.getMany();
    const totalValue = contracts.reduce((sum, c) => sum + Number(c.total_contract_value || 0), 0);
    const totalCommission = contracts.reduce((sum, c) => sum + Number(c.commission_contract || 0), 0);

    return res.json({ contracts, summary: { count: contracts.length, totalValue, totalCommission } });
  }
}
