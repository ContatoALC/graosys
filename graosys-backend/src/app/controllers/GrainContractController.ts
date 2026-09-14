import { Request, Response } from "express";
import { AppDataSource } from "../../database/data-source";
import { GrainContract } from "../entities/GrainContract";
import { ILike } from "typeorm";

export class GrainContractController {
  async create(req: Request, res: Response) {
    const contractRepo = AppDataSource.getRepository(GrainContract);
    const contract = contractRepo.create({
      ...req.body,
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
    Object.assign(contract, req.body);
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
