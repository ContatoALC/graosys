import { MigrationInterface, QueryRunner } from "typeorm";

// Código do broker na corretora (vai no "Nº Corretor/Broker" do contrato).
export class BrokerCode1790294400009 implements MigrationInterface {
  name = "BrokerCode1790294400009";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE brokers ADD COLUMN IF NOT EXISTS code character varying`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE brokers DROP COLUMN IF EXISTS code`);
  }
}
