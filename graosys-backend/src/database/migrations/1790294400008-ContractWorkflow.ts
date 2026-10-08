import { MigrationInterface, QueryRunner } from "typeorm";

// Fluxo do contrato por departamento: pós-venda no contrato, modo do fluxo na corretora e conversão dos status antigos.
export class ContractWorkflow1790294400008 implements MigrationInterface {
  name = "ContractWorkflow1790294400008";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE grain_contracts ADD COLUMN IF NOT EXISTS track_shipment boolean NOT NULL DEFAULT false`);
    await q.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS workflow_mode character varying NOT NULL DEFAULT 'full'`);

    // Ativo / Em Execução / Encerrado / sem status → etapa nova. Enviado por e-mail = já passou pela Execução:
    // vai para a Cobrança (ou Concluído, se a comissão já foi toda recebida). Só converte os status antigos.
    await q.query(`
      WITH sent AS (
        SELECT DISTINCT tenant_id, contract_id FROM contract_email_logs WHERE status = 'sent'
      ), paid AS (
        SELECT c.id
          FROM grain_contracts c
          JOIN billings b ON b.tenant_id = c.tenant_id AND b.number_contract = c.number_contract
         GROUP BY c.id, c.commission_contract
        HAVING count(*) FILTER (WHERE b.status <> 'cancelled') > 0
           AND COALESCE(sum(b.total_service_value) FILTER (WHERE b.status = 'received'), 0) > 0
           AND COALESCE(sum(b.total_service_value) FILTER (WHERE b.status = 'received'), 0) + 0.01 >= COALESCE(c.commission_contract, 0)
      ), mapped AS (
        SELECT c.id, COALESCE(c.status->>'status_current', 'sem status') AS old,
               CASE
                 WHEN c.status->>'status_current' = 'Encerrado' THEN 'Concluído'
                 WHEN EXISTS (SELECT 1 FROM sent s WHERE s.tenant_id = c.tenant_id AND s.contract_id = c.id)
                   THEN CASE WHEN c.id IN (SELECT id FROM paid) THEN 'Concluído' ELSE 'Em Cobrança' END
                 WHEN c.status->>'status_current' = 'Em Execução' THEN 'Aguardando Envio'
                 ELSE 'Em Análise'
               END AS stage
          FROM grain_contracts c
         WHERE c.status IS NULL
            OR COALESCE(c.status->>'status_current', '') IN ('', 'Ativo', 'Em Execução', 'Encerrado')
      )
      UPDATE grain_contracts c
         SET status = jsonb_build_object(
               'status_current', m.stage,
               'history', COALESCE(c.status->'history', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
                 'date', to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY'),
                 'time', to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI:SS'),
                 'at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                 'status', m.stage,
                 'owner_change', 'Sistema',
                 'action', 'migration',
                 'reason', 'Convertido para o fluxo por departamento (antes: ' || m.old || ')')))
        FROM mapped m
       WHERE m.id = c.id`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`
      UPDATE grain_contracts
         SET status = jsonb_set(status, '{status_current}', to_jsonb(CASE status->>'status_current'
               WHEN 'Concluído' THEN 'Encerrado'
               WHEN 'Em Embarque' THEN 'Em Execução'
               WHEN 'Em Cobrança' THEN 'Em Execução'
               ELSE 'Ativo' END))
       WHERE status->>'status_current' IN ('Em Elaboração', 'Devolvido', 'Em Análise', 'Aguardando Envio', 'Em Embarque', 'Em Cobrança', 'Concluído')`);
    await q.query(`ALTER TABLE tenants DROP COLUMN IF EXISTS workflow_mode`);
    await q.query(`ALTER TABLE grain_contracts DROP COLUMN IF EXISTS track_shipment`);
  }
}
