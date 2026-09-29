import { Request, Response } from "express";
import { AppDataSource } from "../../database/data-source";
import { Broker } from "../entities/Broker";
import { brokerContractRows, groupBy, summarize } from "../../services/brokerCommissions";
import { currentRates } from "../../services/contractBrokers";

const isAdmin = (req: Request) => req.user.role === "admin" || req.user.role === "superadmin";

// "Minhas Comissões": o broker vê só os próprios dados; o admin escolhe o broker (e vê o ranking).
export class BrokerPortalController {
  async summary(req: Request, res: Response) {
    const { tenant_id } = req.user;
    const repo = AppDataSource.getRepository(Broker);
    const { from, to } = req.query as Record<string, string>;

    let broker: Broker | null;
    let brokers: Pick<Broker, "id" | "name" | "active">[] | undefined;
    if (isAdmin(req)) {
      brokers = await repo.find({ where: { tenant_id }, select: ["id", "name", "active"], order: { name: "ASC" } });
      const wanted = (req.query.broker_id as string) || (await repo.findOne({ where: { tenant_id, user_id: req.user.id } }))?.id || brokers[0]?.id;
      broker = wanted ? await repo.findOne({ where: { id: wanted, tenant_id } }) : null;
      if (!broker) return res.json({ broker: null, brokers, kpis: null, by_month: [], by_product: [], contracts: [] });
    } else {
      broker = await repo.findOne({ where: { tenant_id, user_id: req.user.id, active: true } });
      if (!broker) return res.status(404).json({ error: "Seu usuário não está vinculado a um broker. Fale com o administrador da corretora." });
    }

    const rows = await brokerContractRows(tenant_id, { brokerId: broker.id, from, to });
    return res.json({
      broker: { id: broker.id, name: broker.name, current_percent: (await currentRates(tenant_id)).get(broker.id) ?? null },
      brokers,
      kpis: summarize(rows),
      by_month: groupBy(rows, (r) => r.contract_date.slice(0, 7)).sort((a, b) => a.key.localeCompare(b.key)),
      by_product: groupBy(rows, (r) => r.name_product || "Sem produto").sort((a, b) => b.volume_kg - a.volume_kg),
      contracts: rows,
    });
  }

  // Produtividade de todos os brokers (só admin).
  async ranking(req: Request, res: Response) {
    const { from, to } = req.query as Record<string, string>;
    const rows = await brokerContractRows(req.user.tenant_id, { from, to });
    const byBroker = groupBy(rows, (r) => r.broker_id).map((g) => ({
      ...g, broker_id: g.key, broker_name: rows.find((r) => r.broker_id === g.key)?.broker_name,
    }));
    return res.json(byBroker.sort((a, b) => b.broker_commission - a.broker_commission));
  }
}
