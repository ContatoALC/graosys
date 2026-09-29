import { MigrationInterface, QueryRunner } from "typeorm";

// Brokers por contrato (com a parte de cada um na comissão), login do broker e tabela de comissão com vigência.
export class ContractBrokers1790294400006 implements MigrationInterface {
  name = "ContractBrokers1790294400006";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE brokers ADD COLUMN IF NOT EXISTS user_id character varying`);

    await q.query(`CREATE TABLE IF NOT EXISTS broker_commission_rates (
      id character varying NOT NULL, tenant_id character varying NOT NULL, broker_id character varying NOT NULL,
      percent numeric(7,4) NOT NULL, valid_from character varying NOT NULL, created_by_name character varying,
      created_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT "PK_42e1eefa1e7e31af9395e6c479c" PRIMARY KEY (id))`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_5de31d4882e32481252cb9b378" ON broker_commission_rates (tenant_id, broker_id)`);

    await q.query(`CREATE TABLE IF NOT EXISTS contract_brokers (
      id character varying NOT NULL, tenant_id character varying NOT NULL, contract_id character varying NOT NULL,
      broker_id character varying NOT NULL, commission_percent numeric(7,4), created_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT "PK_ab519387b38b5396f9f1dc7a625" PRIMARY KEY (id))`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_9ee1f88789a20688b70f506e55" ON contract_brokers (tenant_id, broker_id)`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_d14c72b47dee071318daa39cb5" ON contract_brokers (tenant_id, contract_id)`);

    // Contratos existentes: liga ao broker cujo nome é igual ao "Responsável" (sem diferenciar maiúsculas/espaços).
    // % nulo = usa a tabela de comissão do broker na data do contrato.
    await q.query(`INSERT INTO contract_brokers (id, tenant_id, contract_id, broker_id, commission_percent)
      SELECT gen_random_uuid()::text, c.tenant_id, c.id, b.id, NULL
        FROM grain_contracts c
        JOIN brokers b ON b.tenant_id = c.tenant_id AND LOWER(TRIM(b.name)) = LOWER(TRIM(c.owner_contract))
       WHERE COALESCE(TRIM(c.owner_contract), '') <> ''
         AND NOT EXISTS (SELECT 1 FROM contract_brokers cb WHERE cb.contract_id = c.id)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS contract_brokers`);
    await q.query(`DROP TABLE IF EXISTS broker_commission_rates`);
    await q.query(`ALTER TABLE brokers DROP COLUMN IF EXISTS user_id`);
  }
}
