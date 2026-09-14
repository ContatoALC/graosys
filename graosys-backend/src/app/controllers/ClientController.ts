import { Request, Response } from "express";
import { AppDataSource } from "../../database/data-source";
import { Client } from "../entities/Client";
import { ILike } from "typeorm";

export class ClientController {
  async create(req: Request, res: Response) {
    const clientRepo = AppDataSource.getRepository(Client);
    const client = clientRepo.create({ ...req.body, tenant_id: req.user.tenant_id });
    await clientRepo.save(client);
    return res.status(201).json(client);
  }

  async getAll(req: Request, res: Response) {
    const { search, situation, page = "1", limit = "50" } = req.query;
    const clientRepo = AppDataSource.getRepository(Client);

    const where: any = { tenant_id: req.user.tenant_id };
    if (situation) where.situation = situation;
    if (search) where.name = ILike(`%${search}%`);

    const [clients, total] = await clientRepo.findAndCount({
      where,
      order: { name: "ASC" },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    });

    return res.json({ data: clients, total, page: Number(page), limit: Number(limit) });
  }

  async getById(req: Request, res: Response) {
    const clientRepo = AppDataSource.getRepository(Client);
    const client = await clientRepo.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });
    if (!client) return res.status(404).json({ error: "Cliente não encontrado" });
    return res.json(client);
  }

  async getByCnpjCpf(req: Request, res: Response) {
    const clientRepo = AppDataSource.getRepository(Client);
    const client = await clientRepo.findOne({ where: { cnpj_cpf: req.params.cnpj_cpf, tenant_id: req.user.tenant_id } });
    if (!client) return res.status(404).json({ error: "Cliente não encontrado" });
    return res.json(client);
  }

  async update(req: Request, res: Response) {
    const clientRepo = AppDataSource.getRepository(Client);
    const client = await clientRepo.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });
    if (!client) return res.status(404).json({ error: "Cliente não encontrado" });
    Object.assign(client, req.body);
    await clientRepo.save(client);
    return res.json(client);
  }

  async delete(req: Request, res: Response) {
    const clientRepo = AppDataSource.getRepository(Client);
    const client = await clientRepo.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });
    if (!client) return res.status(404).json({ error: "Cliente não encontrado" });
    await clientRepo.remove(client);
    return res.status(204).send();
  }
}
