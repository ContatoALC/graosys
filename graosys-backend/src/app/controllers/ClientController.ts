import { Request, Response } from "express";
import { AppDataSource } from "../../database/data-source";
import { Client } from "../entities/Client";
import { ILike } from "typeorm";
import { pickFields } from "../../utils/pickFields";
import { resolveCountry } from "../../utils/countries";
import { normalizeBankAccounts, normalizeContacts } from "../../services/contractParties";

// Limpa os e-mails de contato do cliente; devolve a mensagem de erro se houver endereço inválido.
function applyContacts(input: Partial<Client>): string | null {
  if (input.contacts === undefined) return null;
  const contacts = normalizeContacts(input.contacts);
  if (contacts.invalid !== undefined) return `E-mail inválido: ${contacts.invalid.slice(0, 80)}`;
  input.contacts = contacts.list;
  return null;
}

// PF = pessoa física, PJ = pessoa jurídica, EX = estrangeira (sem CPF/CNPJ; documento do país de origem, opcional).
const KINDS = ["PF", "PJ", "EX"];

function kindError(kind: string, countryCode: string): string | null {
  if (!KINDS.includes(kind)) return "Tipo de cliente inválido: use PF, PJ ou EX (estrangeira)";
  if (kind === "EX" && countryCode === "BR") return "Cliente estrangeiro: informe o país de origem (diferente de Brasil)";
  return null;
}

const ALLOWED_FIELDS: (keyof Client)[] = [
  "nickname", "name", "address", "number", "complement", "district", "city", "state",
  "zip_code", "country", "country_code", "kind", "cnpj_cpf", "ins_est", "ins_mun", "telephone", "cellphone",
  "situation", "account", "contacts",
];

export class ClientController {
  async create(req: Request, res: Response) {
    const clientRepo = AppDataSource.getRepository(Client);
    const input = pickFields<Client>(req.body, ALLOWED_FIELDS);
    if (input.account !== undefined) input.account = normalizeBankAccounts(input.account);
    const contactsError = applyContacts(input);
    if (contactsError) return res.status(400).json({ error: contactsError });
    const place = resolveCountry(input.country, input.country_code);
    if ("error" in place) return res.status(400).json({ error: place.error });
    const kindProblem = kindError(input.kind, place.country_code);
    if (kindProblem) return res.status(400).json({ error: kindProblem });
    if (input.kind === "EX") input.cnpj_cpf = input.cnpj_cpf ?? "";
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
    if (input.account !== undefined) input.account = normalizeBankAccounts(input.account);
    const contactsError = applyContacts(input);
    if (contactsError) return res.status(400).json({ error: contactsError });
    if (input.country !== undefined || input.country_code !== undefined) {
      // Trocar o país sem informar o código faz o código ser inferido; desconhecido exige o código.
      const place = resolveCountry(input.country ?? client.country, input.country_code ?? (input.country !== undefined ? undefined : client.country_code));
      if ("error" in place) return res.status(400).json({ error: place.error });
      Object.assign(input, place);
    }
    if (input.kind !== undefined || input.country_code !== undefined) {
      const kindProblem = kindError(input.kind ?? client.kind, input.country_code ?? client.country_code);
      if (kindProblem) return res.status(400).json({ error: kindProblem });
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
