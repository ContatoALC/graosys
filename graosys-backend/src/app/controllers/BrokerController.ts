import { Request, Response } from "express";
import { AppDataSource } from "../../database/data-source";
import { Broker } from "../entities/Broker";
import { pickFields } from "../../utils/pickFields";

const BROKER_ALLOWED_FIELDS: (keyof Broker)[] = ["name", "cnpj_cpf", "email", "phone", "active"];

export class BrokerController {
  async create(req: Request, res: Response) {
    const repo = AppDataSource.getRepository(Broker);
    const data = pickFields<Broker>(req.body, BROKER_ALLOWED_FIELDS);
    if (!data.name) return res.status(400).json({ error: "Nome é obrigatório" });
    if (data.cnpj_cpf) {
      const existing = await repo.findOne({ where: { cnpj_cpf: data.cnpj_cpf, tenant_id: req.user.tenant_id } });
      if (existing) return res.status(400).json({ error: "Broker com este CNPJ/CPF já existe" });
    }
    const broker = repo.create({ ...data, tenant_id: req.user.tenant_id });
    await repo.save(broker);
    return res.status(201).json(broker);
  }

  async getAll(req: Request, res: Response) {
    const repo = AppDataSource.getRepository(Broker);
    const brokers = await repo.find({ where: { tenant_id: req.user.tenant_id }, order: { name: "ASC" } });
    return res.json(brokers);
  }

  async getById(req: Request, res: Response) {
    const repo = AppDataSource.getRepository(Broker);
    const broker = await repo.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });
    if (!broker) return res.status(404).json({ error: "Broker não encontrado" });
    return res.json(broker);
  }

  async update(req: Request, res: Response) {
    const repo = AppDataSource.getRepository(Broker);
    const broker = await repo.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });
    if (!broker) return res.status(404).json({ error: "Broker não encontrado" });
    const data = pickFields<Broker>(req.body, BROKER_ALLOWED_FIELDS);
    if (data.cnpj_cpf && data.cnpj_cpf !== broker.cnpj_cpf) {
      const existing = await repo.findOne({ where: { cnpj_cpf: data.cnpj_cpf, tenant_id: req.user.tenant_id } });
      if (existing) return res.status(400).json({ error: "Broker com este CNPJ/CPF já existe" });
    }
    Object.assign(broker, data);
    await repo.save(broker);
    return res.json(broker);
  }

  async delete(req: Request, res: Response) {
    const repo = AppDataSource.getRepository(Broker);
    const broker = await repo.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });
    if (!broker) return res.status(404).json({ error: "Broker não encontrado" });
    await repo.remove(broker);
    return res.status(204).send();
  }
}
