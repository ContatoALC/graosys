import { MigrationInterface, QueryRunner } from "typeorm";

// Completa bancos criados antes destas funcionalidades (ex.: produção). Idempotente.
export class CatchUpPlatformFeatures1790294400001 implements MigrationInterface {
  name = "CatchUpPlatformFeatures1790294400001";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at timestamp`);
    await q.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS country varchar NOT NULL DEFAULT 'Brasil'`);

    await q.query(`CREATE TABLE IF NOT EXISTS brokers (
      id varchar PRIMARY KEY, tenant_id varchar NOT NULL, name varchar NOT NULL, cnpj_cpf varchar, email varchar, phone varchar,
      active boolean NOT NULL DEFAULT true, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now())`);

    await q.query(`CREATE TABLE IF NOT EXISTS tenant_email_settings (
      id varchar PRIMARY KEY, tenant_id varchar NOT NULL UNIQUE, smtp_host varchar NOT NULL, smtp_port int NOT NULL DEFAULT 587,
      smtp_secure boolean NOT NULL DEFAULT false, smtp_user varchar NOT NULL, smtp_pass_encrypted text NOT NULL, from_name varchar,
      from_email varchar, bcc_emails jsonb DEFAULT '[]', signature text, active boolean NOT NULL DEFAULT true,
      created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now())`);

    await q.query(`CREATE TABLE IF NOT EXISTS tenant_pdf_settings (
      id varchar PRIMARY KEY, tenant_id varchar NOT NULL UNIQUE, logo_data text, logo_position varchar NOT NULL DEFAULT 'left',
      logo_width int NOT NULL DEFAULT 120, watermark_data text, watermark_opacity double precision NOT NULL DEFAULT '0.1',
      watermark_enabled boolean NOT NULL DEFAULT false, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now())`);

    await q.query(`CREATE TABLE IF NOT EXISTS leads (
      id varchar PRIMARY KEY, name varchar NOT NULL, region varchar, status varchar NOT NULL DEFAULT 'a_contatar', probable_plan varchar,
      phones jsonb NOT NULL DEFAULT '[]', email varchar, address varchar, cnpj varchar, corporate_name varchar, site varchar, hook text,
      decision_maker varchar, whatsapp varchar, next_step varchar, next_step_date date,
      created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now())`);

    await q.query(`CREATE TABLE IF NOT EXISTS contract_email_logs (
      id varchar PRIMARY KEY, tenant_id varchar NOT NULL, contract_id varchar NOT NULL, party varchar NOT NULL, party_names text,
      recipients jsonb NOT NULL DEFAULT '[]', subject varchar, copy_correct boolean NOT NULL DEFAULT false,
      status varchar NOT NULL DEFAULT 'sent', error text, sent_by_id varchar, sent_by_name varchar, sent_by_email varchar,
      sent_at timestamp NOT NULL DEFAULT now())`);
    // Nome gerado pelo TypeORM para @Index(["tenant_id", "contract_id"]); mantém entidade e banco alinhados.
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_853155efcb364e85d9f36650de" ON contract_email_logs (tenant_id, contract_id)`);

    await q.query(`UPDATE tenants SET plan = CASE plan WHEN 'basic' THEN 'essencial' WHEN 'pro' THEN 'profissional'
      WHEN 'enterprise' THEN 'corporativo' ELSE plan END WHERE plan IN ('basic', 'pro', 'enterprise')`);
  }

  public async down(): Promise<void> {
    throw new Error("Migration não reversível: apenas adiciona estruturas e é segura de reaplicar.");
  }
}
