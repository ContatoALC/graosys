import { Request, Response } from "express";
import { AppDataSource } from "../../database/data-source";
import { Client } from "../entities/Client";
import { ILike } from "typeorm";
import { pickFields } from "../../utils/pickFields";
import { resolveCountry } from "../../utils/countries";

const ALLOWED_FIELDS: (keyof Client)[] = [
  "nickname", "name", "address", "number", "complement", "district", "city", "state",
  "zip_code", "country", "country_code", "kind", "cnpj_cpf", "ins_est", "ins_mun", "telephone", "cellphone",
  "situation", "account", "contacts",
];

export class ClientController {
  async create(req: Request, res: Response) {
    const clientRepo = AppDataSource.getRepository(Client);
    const input = pickFields<Client>(req.body, ALLOWED_FIELDS);
    const place = resolveCountry(input.country, input.country_code);
    if ("error" in place) return res.status(400).json({ error: place.error });
    const client = clientRepo.create({ ...input, ...place, tenant_id: req.user.tenant_id });
    await clientRepo.save(client);
    return res.status(201).json(client);
  }

  async getAll(req: Request, res: Response) {
    const { search, situation, page = "1", limit = "50" } = req.query;
    const clientRepo = AppDataSource.getRepository(Client);

    const base: any = { tenant_id: req.user.tenant_id };
    if (situation) base.situation = situation;
    const term = search ? `%${String(search).trim()}%` : "";
    const where = term
      ? [{ ...base, name: ILike(term) }, { ...base, nickname: ILike(term) }, { ...base, cnpj_cpf: ILike(term) }]
      : base;

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
    const input = pickFields<Client>(req.body, ALLOWED_FIELDS);
    if (input.country !== undefined || input.country_code !== undefined) {
      // Trocar o país sem informar o código faz o código ser inferido; desconhecido exige o código.
      const place = resolveCountry(input.country ?? client.country, input.country_code ?? (input.country !== undefined ? undefined : client.country_code));
      if ("error" in place) return res.status(400).json({ error: place.error });
      Object.assign(input, place);
    }
    Object.assign(client, input);
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
