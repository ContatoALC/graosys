import { Request, Response } from "express";
import { AppDataSource } from "../../database/data-source";
import { GrainContract } from "../entities/GrainContract";
import { Tenant } from "../entities/Tenant";
import { insertMaskInCnpj } from "../../utils/format";
import { clientIp, userAgent, writeAudit } from "../../services/audit";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VERIFY_WINDOW = "1 minute";
const MAX_VERIFY_PER_IP = 30;

// Limite pela própria trilha de auditoria (como o login): funciona sem memória compartilhada.
async function tooManyVerifications(ip: string | null): Promise<boolean> {
  if (!ip) return false;
  const [row] = await AppDataSource.query(
    `SELECT count(*) AS n FROM audit_logs WHERE action = 'contracts.verify' AND ip = $1 AND created_at > now() - $2::interval`,
    [ip, VERIFY_WINDOW]
  );
  return Number(row?.n) >= MAX_VERIFY_PER_IP;
}

// Conferência pública do contrato pelo QR code do PDF (sem login): selo de autenticidade, não cópia do contrato.
// Confirma só que o contrato existe, de qual corretora é e se está cancelado; partes, volume e preço ficam de fora.
export class ContractVerificationController {
  async verify(req: Request, res: Response) {
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    res.setHeader("Cache-Control", "no-store");
    const ip = clientIp(req);
    if (await tooManyVerifications(ip)) {
      return res.status(429).json({ error: "Muitas consultas. Aguarde um minuto e tente novamente." });
    }

    const contract = UUID.test(req.params.id)
      ? await AppDataSource.getRepository(GrainContract).findOne({ where: { id: req.params.id } })
      : null;
    const tenant = contract && (await AppDataSource.getRepository(Tenant).findOne({ where: { id: contract.tenant_id } }));
    // Toda consulta fica na auditoria (a da corretora, quando o contrato existe) e conta para o limite.
    await writeAudit({
      tenant_id: tenant ? tenant.id : null, action: "contracts.verify", entity: "contracts",
      entity_id: contract ? contract.id : null, method: "GET", path: "/api/public/contracts/:id/verify",
      status_code: tenant ? 200 : 404, metadata: {}, ip, user_agent: userAgent(req),
    });
    if (!contract || !tenant) return res.status(404).json({ error: "Contrato não encontrado" });

    return res.json({
      broker: { name: tenant.name, cnpj: tenant.cnpj ? insertMaskInCnpj(tenant.cnpj) : null },
      number_contract: contract.number_contract,
      product: contract.name_product,
      crop: contract.crop,
      contract_emission_date: contract.contract_emission_date,
      cancelled: contract.status?.status_current === "Cancelado",
    });
  }
}
