import { Request, Response } from "express";
import { AppDataSource } from "../../database/data-source";
import { Tenant } from "../entities/Tenant";

export class TenantController {
  async getCurrent(req: Request, res: Response) {
    const tenantRepo = AppDataSource.getRepository(Tenant);
    const tenant = await tenantRepo.findOne({ where: { id: req.user.tenant_id } });
    if (!tenant) return res.status(404).json({ error: "Tenant não encontrado" });
    return res.json(tenant);
  }

  async update(req: Request, res: Response) {
    if (req.user.role !== "admin" && req.user.role !== "superadmin") {
      return res.status(403).json({ error: "Apenas administradores podem editar os dados da corretora" });
    }
    const tenantRepo = AppDataSource.getRepository(Tenant);
    const tenant = await tenantRepo.findOne({ where: { id: req.user.tenant_id } });
    if (!tenant) return res.status(404).json({ error: "Tenant não encontrado" });

    const { name, cnpj, email, phone } = req.body;
    Object.assign(tenant, { name, cnpj, email, phone });
    await tenantRepo.save(tenant);
    return res.json(tenant);
  }
}
