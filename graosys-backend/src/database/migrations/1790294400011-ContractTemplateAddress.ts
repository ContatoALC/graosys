import { MigrationInterface, QueryRunner } from "typeorm";

// Opção do modelo de contrato para mostrar o endereço da corretora no cabeçalho do PDF (desligada: PDF igual ao de antes).
export class ContractTemplateAddress1790294400011 implements MigrationInterface {
  name = "ContractTemplateAddress1790294400011";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE contract_templates ADD COLUMN IF NOT EXISTS show_address boolean NOT NULL DEFAULT false`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE contract_templates DROP COLUMN IF EXISTS show_address`);
  }
}
