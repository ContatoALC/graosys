import { Request, Response } from "express";
import { AppDataSource } from "../../database/data-source";
import { Tenant } from "../entities/Tenant";
import { User } from "../entities/User";
import bcrypt from "bcrypt";

export class TenantController {
  // Criação de novo tenant (registro de corretora)
  async register(req: Request, res: Response) {
    const { tenant_name, tenant_slug, cnpj, email, phone, admin_name, admin_password } = req.body;

    const tenantRepo = AppDataSource.getRepository(Tenant);
    const userRepo = AppDataSource.getRepository(User);

    const existing = await tenantRepo.findOne({ where: { slug: tenant_slug } });
    if (existing) {
      return res.status(400).json({ error: "Este identificador já está em uso" });
    }

    const tenant = tenantRepo.create({ name: tenant_name, slug: tenant_slug, cnpj, email, phone, status: "active", plan: "trial" });
    await tenantRepo.save(tenant);

    const hashedPassword = await bcrypt.hash(admin_password, 10);
    const adminUser = userRepo.create({
      tenant_id: tenant.id,
      name: admin_name,
      email,
      password: hashedPassword,
      role: "admin",
      permissions: {},
    });
    await userRepo.save(adminUser);

    return res.status(201).json({ message: "Corretora registrada com sucesso", tenant_id: tenant.id, slug: tenant.slug });
  }

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
