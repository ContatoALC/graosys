import { Request, Response } from "express";
import { AppDataSource } from "../../database/data-source";
import { Billing } from "../entities/Billing";

export class BillingController {
  async create(req: Request, res: Response) {
    const billingRepo = AppDataSource.getRepository(Billing);
    const billing = billingRepo.create({ ...req.body, tenant_id: req.user.tenant_id, owner_record: req.user.name });
    await billingRepo.save(billing);
    return res.status(201).json(billing);
  }

  async getAll(req: Request, res: Response) {
    const { year, status, page = "1", limit = "50" } = req.query;
    const billingRepo = AppDataSource.getRepository(Billing);

    const where: any = { tenant_id: req.user.tenant_id };
    if (year) where.year = year;
    if (status) where.status = status;

    const [billings, total] = await billingRepo.findAndCount({
      where,
      order: { receipt_date: "DESC" },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    });

    return res.json({ data: billings, total, page: Number(page), limit: Number(limit) });
  }

  async getById(req: Request, res: Response) {
    const billingRepo = AppDataSource.getRepository(Billing);
    const billing = await billingRepo.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });
    if (!billing) return res.status(404).json({ error: "Recebimento não encontrado" });
    return res.json(billing);
  }

  async getByNumberContract(req: Request, res: Response) {
    const billingRepo = AppDataSource.getRepository(Billing);
    const billings = await billingRepo.find({ where: { number_contract: req.params.number_contract, tenant_id: req.user.tenant_id } });
    return res.json(billings);
  }

  async update(req: Request, res: Response) {
    const billingRepo = AppDataSource.getRepository(Billing);
    const billing = await billingRepo.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });
    if (!billing) return res.status(404).json({ error: "Recebimento não encontrado" });
    Object.assign(billing, req.body);
    await billingRepo.save(billing);
    return res.json(billing);
  }

  async delete(req: Request, res: Response) {
    const billingRepo = AppDataSource.getRepository(Billing);
    const billing = await billingRepo.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });
    if (!billing) return res.status(404).json({ error: "Recebimento não encontrado" });
    await billingRepo.remove(billing);
    return res.status(204).send();
  }

  async getSummary(req: Request, res: Response) {
    const billingRepo = AppDataSource.getRepository(Billing);
    const { year } = req.query;

    const qb = billingRepo.createQueryBuilder("b")
      .where("b.tenant_id = :tenant_id", { tenant_id: req.user.tenant_id });

    if (year) qb.andWhere("b.year = :year", { year });

    const billings = await qb.getMany();

    const totalReceived = billings.filter(b => b.status === "received").reduce((sum, b) => sum + Number(b.liquid_value), 0);
    const totalPending = billings.filter(b => b.status === "pending").reduce((sum, b) => sum + Number(b.liquid_value), 0);

    return res.json({
      billings,
      summary: {
        total: billings.length,
        totalReceived,
        totalPending,
        countReceived: billings.filter(b => b.status === "received").length,
        countPending: billings.filter(b => b.status === "pending").length,
      },
    });
  }
}
