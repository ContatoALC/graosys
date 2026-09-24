import { Request, Response } from "express";
import { ILike } from "typeorm";
import { AppDataSource } from "../../database/data-source";
import { Lead } from "../entities/Lead";
import { pickFields } from "../../utils/pickFields";

export const LEAD_STATUSES = ["a_contatar", "ligacao_feita", "reuniao_marcada", "demo_feita", "proposta_enviada", "fechado", "perdido"];

const FIELDS: (keyof Lead)[] = [
  "name", "region", "status", "probable_plan", "phones", "email", "address", "cnpj", "corporate_name",
  "site", "hook", "decision_maker", "whatsapp", "next_step", "next_step_date",
];

const repo = () => AppDataSource.getRepository(Lead);

function validate(data: Partial<Lead>, creating: boolean): string | null {
  if (creating && !data.name) return "Nome é obrigatório";
  if (data.name !== undefined && !String(data.name).trim()) return "Nome é obrigatório";
  if (data.status !== undefined && !LEAD_STATUSES.includes(data.status)) return "Etapa inválida";
  if (data.phones !== undefined) {
    const ok = Array.isArray(data.phones) && data.phones.every((p) => p && typeof p.number === "string" && typeof p.label === "string");
    if (!ok) return "Telefones inválidos";
  }
  if (data.next_step_date && !/^\d{4}-\d{2}-\d{2}$/.test(data.next_step_date)) return "Data inválida";
  return null;
}

// Campos opcionais vazios viram null.
function normalize(data: Partial<Lead>): Partial<Lead> {
  const out: any = { ...data };
  for (const k of Object.keys(out)) if (out[k] === "") out[k] = null;
  return out;
}

export class LeadController {
  async list(req: Request, res: Response) {
    const search = String(req.query.search || "").trim();
    const where = search
      ? [{ name: ILike(`%${search}%`) }, { region: ILike(`%${search}%`) }, { decision_maker: ILike(`%${search}%`) }]
      : undefined;
    const leads = await repo().find({ where, order: { created_at: "ASC" } });
    return res.json(leads);
  }

  async get(req: Request, res: Response) {
    const lead = await repo().findOne({ where: { id: req.params.id } });
    if (!lead) return res.status(404).json({ error: "Lead não encontrado" });
    return res.json(lead);
  }

  async create(req: Request, res: Response) {
    const data = normalize(pickFields<Lead>(req.body, FIELDS));
    const err = validate(data, true);
    if (err) return res.status(400).json({ error: err });
    const lead = await repo().save(repo().create({ phones: [], ...data }));
    return res.status(201).json(lead);
  }

  async update(req: Request, res: Response) {
    const lead = await repo().findOne({ where: { id: req.params.id } });
    if (!lead) return res.status(404).json({ error: "Lead não encontrado" });
    const data = normalize(pickFields<Lead>(req.body, FIELDS));
    const err = validate(data, false);
    if (err) return res.status(400).json({ error: err });
    Object.assign(lead, data);
    await repo().save(lead);
    return res.json(lead);
  }

  async delete(req: Request, res: Response) {
    const lead = await repo().findOne({ where: { id: req.params.id } });
    if (!lead) return res.status(404).json({ error: "Lead não encontrado" });
    await repo().remove(lead);
    return res.status(204).send();
  }
}
