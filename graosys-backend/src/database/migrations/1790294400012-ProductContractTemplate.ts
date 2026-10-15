import { MigrationInterface, QueryRunner } from "typeorm";

// Modelo de contrato sugerido por produto: o contrato novo já vem com ele escolhido (nulo = padrão da corretora).
export class ProductContractTemplate1790294400012 implements MigrationInterface {
  name = "ProductContractTemplate1790294400012";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS template_id character varying`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE products DROP COLUMN IF EXISTS template_id`);
  }
}
