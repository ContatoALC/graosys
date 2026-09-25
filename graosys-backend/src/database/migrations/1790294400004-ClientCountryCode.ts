import { MigrationInterface, QueryRunner } from "typeorm";

export class ClientCountryCode1790294400004 implements MigrationInterface {
  name = "ClientCountryCode1790294400004";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS country_code character varying NOT NULL DEFAULT 'BR'`);
  }

  public async down(): Promise<void> {
    throw new Error("Migration não reversível.");
  }
}
