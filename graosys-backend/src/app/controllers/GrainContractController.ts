import { Request, Response } from "express";
import { AppDataSource } from "../../database/data-source";
import { GrainContract } from "../entities/GrainContract";
import { ILike } from "typeorm";
import { pickFields } from "../../utils/pickFields";

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
];

export class GrainContractController {
  async create(req: Request, res: Response) {
    const contractRepo = AppDataSource.getRepository(GrainContract);
    const contract = contractRepo.create({
      ...pickFields<GrainContract>(req.body, ALLOWED_FIELDS),
      tenant_id: req.user.tenant_id,
      status: {
        status_current: "Ativo",
        history: [{ date: new Date().toLocaleDateString("pt-BR"), time: new Date().toLocaleTimeString("pt-BR"), status: "Ativo", owner_change: req.user.name }],
      },
    });
    await contractRepo.save(contract);
    return res.status(201).json(contract);
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
    Object.assign(contract, pickFields<GrainContract>(req.body, ALLOWED_FIELDS));
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
