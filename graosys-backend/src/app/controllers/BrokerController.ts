import { Request, Response } from "express";
import { AppDataSource } from "../../database/data-source";
import { Broker } from "../entities/Broker";
import { pickFields } from "../../utils/pickFields";
import { User } from "../entities/User";
import { ContractBroker } from "../entities/ContractBroker";
import { BrokerCommissionRate } from "../entities/BrokerCommissionRate";
import { currentRates } from "../../services/contractBrokers";

const BROKER_ALLOWED_FIELDS: (keyof Broker)[] = ["name", "code", "cnpj_cpf", "email", "phone", "active", "user_id"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Valida o código (único na corretora) e o vínculo com usuário; devolve mensagem de erro ou null.
async function validateLinks(req: Request, data: Partial<Broker>, brokerId?: string): Promise<string | null> {
  if (data.code !== undefined) {
    data.code = String(data.code ?? "").trim().slice(0, 30) || null;
    if (data.code) {
      const [taken] = await AppDataSource.query(
        `SELECT name FROM brokers WHERE tenant_id = $1 AND lower(code) = lower($2) AND id <> $3 LIMIT 1`,
        [req.user.tenant_id, data.code, brokerId ?? ""]
      );
      if (taken) return `O código ${data.code} já é do broker ${taken.name}`;
    }
  }
  if (data.user_id !== undefined) {
    data.user_id = data.user_id || null;
    if (data.user_id) {
      const user = await AppDataSource.getRepository(User).findOne({ where: { id: data.user_id, tenant_id: req.user.tenant_id } });
      if (!user) return "Usuário não encontrado nesta corretora";
      const other = await AppDataSource.getRepository(Broker).findOne({ where: { user_id: data.user_id, tenant_id: req.user.tenant_id } });
      if (other && other.id !== brokerId) return `Este usuário já está vinculado ao broker ${other.name}`;
    }
  }
  return null;
}

export class BrokerController {
  async create(req: Request, res: Response) {
    const repo = AppDataSource.getRepository(Broker);
    const data = pickFields<Broker>(req.body, BROKER_ALLOWED_FIELDS);
    if (!data.name) return res.status(400).json({ error: "Nome é obrigatório" });
    const linkError = await validateLinks(req, data);
    if (linkError) return res.status(400).json({ error: linkError });
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
    const rates = await currentRates(req.user.tenant_id);
    return res.json(brokers.map((b) => ({ ...b, current_percent: rates.get(b.id) ?? null })));
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
    const linkError = await validateLinks(req, data, broker.id);
    if (linkError) return res.status(400).json({ error: linkError });
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
    const linked = await AppDataSource.getRepository(ContractBroker).count({ where: { tenant_id: req.user.tenant_id, broker_id: broker.id } });
    if (linked) return res.status(400).json({ error: `Este broker está em ${linked} contrato(s). Marque-o como inativo em vez de excluir.` });
    await AppDataSource.getRepository(BrokerCommissionRate).delete({ tenant_id: req.user.tenant_id, broker_id: broker.id });
    await repo.remove(broker);
    return res.status(204).send();
  }

  // Tabela de comissão do broker (vigências).
  async listRates(req: Request, res: Response) {
    const rates = await AppDataSource.getRepository(BrokerCommissionRate).find({
      where: { tenant_id: req.user.tenant_id, broker_id: req.params.id }, order: { valid_from: "DESC", created_at: "DESC" },
    });
    return res.json(rates.map((r) => ({ ...r, percent: Number(r.percent) })));
  }

  async addRate(req: Request, res: Response) {
    const broker = await AppDataSource.getRepository(Broker).findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });
    if (!broker) return res.status(404).json({ error: "Broker não encontrado" });
    const percent = Number(req.body.percent);
    const validFrom = String(req.body.valid_from || "");
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) return res.status(400).json({ error: "O % deve estar entre 0 e 100" });
    if (!DATE_RE.test(validFrom)) return res.status(400).json({ error: "Informe a data de início da vigência" });
    const repo = AppDataSource.getRepository(BrokerCommissionRate);
    const same = await repo.findOne({ where: { tenant_id: req.user.tenant_id, broker_id: broker.id, valid_from: validFrom } });
    if (same) return res.status(400).json({ error: "Já existe um % com início nesta data. Exclua-o antes de lançar outro." });
    const rate = await repo.save(repo.create({ tenant_id: req.user.tenant_id, broker_id: broker.id, percent, valid_from: validFrom, created_by_name: req.user.name }));
    return res.status(201).json({ ...rate, percent: Number(rate.percent) });
  }

  async deleteRate(req: Request, res: Response) {
    const repo = AppDataSource.getRepository(BrokerCommissionRate);
    const rate = await repo.findOne({ where: { id: req.params.rateId, broker_id: req.params.id, tenant_id: req.user.tenant_id } });
    if (!rate) return res.status(404).json({ error: "Vigência não encontrada" });
    await repo.remove(rate);
    return res.status(204).send();
  }
}
