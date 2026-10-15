import { MigrationInterface, QueryRunner } from "typeorm";

// Modelos de contrato por corretora (idioma, campos, cláusulas, visual do PDF) e o modelo/texto enviado em cada contrato.
// Cada corretora ganha o modelo "Padrão", igual ao PDF de antes, com o logo e a marca d'água do Layout do PDF.
export class ContractTemplates1790294400010 implements MigrationInterface {
  name = "ContractTemplates1790294400010";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS contract_templates (
      id character varying NOT NULL, tenant_id character varying NOT NULL, name character varying NOT NULL,
      language character varying NOT NULL DEFAULT 'pt-BR', is_default boolean NOT NULL DEFAULT false,
      active boolean NOT NULL DEFAULT true, title character varying NOT NULL, fields jsonb NOT NULL DEFAULT '[]',
      show_fixations boolean NOT NULL DEFAULT true, clauses jsonb NOT NULL DEFAULT '[]', closing_text text NOT NULL DEFAULT '',
      signatures jsonb NOT NULL DEFAULT '[]', logo_data text, logo_position character varying NOT NULL DEFAULT 'left',
      logo_width integer NOT NULL DEFAULT '120', watermark_data text, watermark_opacity double precision NOT NULL DEFAULT '0.1',
      watermark_enabled boolean NOT NULL DEFAULT false, created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT "PK_59af2fd9eadd293fe10fdb2c702" PRIMARY KEY (id))`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_d3163231f9b14548e60bbd89c2" ON contract_templates (tenant_id)`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_contract_templates_default" ON contract_templates (tenant_id) WHERE is_default`);

    await q.query(`ALTER TABLE grain_contracts ADD COLUMN IF NOT EXISTS template_id character varying`);
    await q.query(`ALTER TABLE grain_contracts ADD COLUMN IF NOT EXISTS template_snapshot jsonb`);

    // Campos na ordem do PDF de antes (fixo aqui: não acompanha mudanças futuras do código).
    const fields = ["number_contract", "seller", "buyer", "product", "crop", "quality", "quantity", "price", "icms", "payment",
      "pickup_location", "pickup_period", "destination", "external_number", "inspection", "commission", "observation"]
      .map((key) => ({ key, visible: true, label: null }));
    await q.query(`INSERT INTO contract_templates (id, tenant_id, name, language, is_default, active, title, fields, show_fixations,
        clauses, closing_text, signatures, logo_data, logo_position, logo_width, watermark_data, watermark_opacity, watermark_enabled)
      SELECT gen_random_uuid()::text, t.id, 'Padrão', 'pt-BR', true, true, 'CONFIRMAÇÃO DE CONTRATO', $1::jsonb, true,
        '[]'::jsonb, 'Solicitamos carimbar, assinar e devolver esta confirmação por e-mail.', $2::jsonb,
        s.logo_data, COALESCE(s.logo_position, 'left'), COALESCE(s.logo_width, 120), s.watermark_data,
        COALESCE(s.watermark_opacity, 0.1), COALESCE(s.watermark_enabled, false)
        FROM tenants t
        LEFT JOIN tenant_pdf_settings s ON s.tenant_id = t.id
       WHERE NOT EXISTS (SELECT 1 FROM contract_templates c WHERE c.tenant_id = t.id)`,
      [JSON.stringify(fields), JSON.stringify(["Assinatura / Carimbo", "Data"])]);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE grain_contracts DROP COLUMN IF EXISTS template_snapshot`);
    await q.query(`ALTER TABLE grain_contracts DROP COLUMN IF EXISTS template_id`);
    await q.query(`DROP INDEX IF EXISTS "UQ_contract_templates_default"`);
    await q.query(`DROP TABLE IF EXISTS contract_templates`);
  }
}
