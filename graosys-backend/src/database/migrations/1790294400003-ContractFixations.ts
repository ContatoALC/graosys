import { MigrationInterface, QueryRunner } from "typeorm";

// Contratos a fixar (Mercado e Frame): colunas no contrato e tabela de fixações. Só adiciona estruturas.
export class ContractFixations1790294400003 implements MigrationInterface {
  name = "ContractFixations1790294400003";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE grain_contracts
      ADD COLUMN IF NOT EXISTS price_type character varying NOT NULL DEFAULT 'fixed',
      ADD COLUMN IF NOT EXISTS fixation_mode character varying,
      ADD COLUMN IF NOT EXISTS cbot_reference character varying,
      ADD COLUMN IF NOT EXISTS fixation_deadline character varying,
      ADD COLUMN IF NOT EXISTS frame_chicago numeric(15,4),
      ADD COLUMN IF NOT EXISTS frame_premium numeric(15,4),
      ADD COLUMN IF NOT EXISTS frame_exchange numeric(15,6),
      ADD COLUMN IF NOT EXISTS fixed_quantity numeric(15,4) NOT NULL DEFAULT 0`);

    await q.query(`CREATE TABLE IF NOT EXISTS contract_fixations (
      id character varying NOT NULL, tenant_id character varying NOT NULL, contract_id character varying NOT NULL,
      fixation_date character varying NOT NULL, quantity numeric(15,4) NOT NULL, mode character varying NOT NULL,
      chicago numeric(15,4), premium numeric(15,4), exchange_rate numeric(15,6), price numeric(15,4) NOT NULL,
      notes character varying, created_by_id character varying, created_by_name character varying,
      created_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT "PK_9ab24a7c4ffe3e07929de3844bb" PRIMARY KEY (id))`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_f0a07c01872bb7942a35db7b0c" ON contract_fixations (tenant_id, contract_id)`);
  }

  public async down(): Promise<void> {
    throw new Error("Migration não reversível: preserva as fixações lançadas.");
  }
}
