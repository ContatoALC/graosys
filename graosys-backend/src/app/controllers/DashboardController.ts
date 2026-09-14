import { Request, Response } from "express";
import { AppDataSource } from "../../database/data-source";
import { GrainContract } from "../entities/GrainContract";
import { Client } from "../entities/Client";
import { Billing } from "../entities/Billing";

export class DashboardController {
  async getSummary(req: Request, res: Response) {
    const { tenant_id } = req.user;
    const { year = new Date().getFullYear().toString() } = req.query;

    const contractRepo = AppDataSource.getRepository(GrainContract);
    const clientRepo = AppDataSource.getRepository(Client);
    const billingRepo = AppDataSource.getRepository(Billing);

    const [totalContracts, activeClients] = await Promise.all([
      contractRepo.count({ where: { tenant_id } }),
      clientRepo.count({ where: { tenant_id, situation: "active" } }),
    ]);

    const billings = await billingRepo.find({ where: { tenant_id, year: String(year) } });

    const totalReceived = billings.filter(b => b.status === "received").reduce((s, b) => s + Number(b.liquid_value), 0);
    const totalPending = billings.filter(b => b.status === "pending").reduce((s, b) => s + Number(b.liquid_value), 0);

    const recentContracts = await contractRepo.find({
      where: { tenant_id },
      order: { created_at: "DESC" },
      take: 5,
    });

    return res.json({
      kpis: { totalContracts, activeClients, totalReceived, totalPending },
      recentContracts,
    });
  }
}
