import { Request, Response } from "express";
import { AppDataSource } from "../../database/data-source";
import { Tenant } from "../entities/Tenant";
import { pickFields } from "../../utils/pickFields";

const ALLOWED_FIELDS: (keyof Tenant)[] = ["name", "cnpj", "email", "phone", "address", "number", "complement", "district", "city", "state", "zip_code", "workflow_mode"];

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

    const input = pickFields<Tenant>(req.body, ALLOWED_FIELDS);
    if (input.name !== undefined && !String(input.name).trim()) return res.status(400).json({ error: "Informe o nome da corretora" });
    if (input.workflow_mode !== undefined && !["full", "simple"].includes(input.workflow_mode)) return res.status(400).json({ error: "Modo de fluxo inválido" });
    // Grava só os campos enviados: um save() da corretora inteira desfaria o que outra requisição acabou de salvar.
    if (Object.keys(input).length > 0) await tenantRepo.update({ id: tenant.id }, input);
    return res.json(await tenantRepo.findOne({ where: { id: tenant.id } }));
  }
}
