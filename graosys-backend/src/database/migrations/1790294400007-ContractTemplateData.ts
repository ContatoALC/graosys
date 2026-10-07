import { MigrationInterface, QueryRunner } from "typeorm";

// Dados para os templates de contrato: vínculo das partes com o cadastro, conta de pagamento,
// numeração e memória de cálculo das fixações e endereço da corretora.
export class ContractTemplateData1790294400007 implements MigrationInterface {
  name = "ContractTemplateData1790294400007";

  public async up(q: QueryRunner): Promise<void> {
    for (const col of ["address", "number", "complement", "district", "city", "state", "zip_code"]) {
      await q.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "${col}" character varying`);
    }

    await q.query(`ALTER TABLE grain_contracts ADD COLUMN IF NOT EXISTS seller_ids jsonb DEFAULT '[]'`);
    await q.query(`ALTER TABLE grain_contracts ADD COLUMN IF NOT EXISTS buyer_ids jsonb DEFAULT '[]'`);
    await q.query(`ALTER TABLE grain_contracts ADD COLUMN IF NOT EXISTS payment_account jsonb`);

    await q.query(`ALTER TABLE contract_fixations ADD COLUMN IF NOT EXISTS sequence integer`);
    await q.query(`ALTER TABLE contract_fixations ADD COLUMN IF NOT EXISTS conversion_factor numeric(15,6)`);
    await q.query(`ALTER TABLE contract_fixations ADD COLUMN IF NOT EXISTS fobbings numeric(15,4)`);
    await q.query(`ALTER TABLE contract_fixations ADD COLUMN IF NOT EXISTS ppe numeric(15,4)`);

    // Contratos existentes: liga cada nome ao cliente da mesma corretora com razão social ou apelido igual
    // (sem diferenciar maiúsculas/espaços). Nome sem cadastro ou com mais de um cadastro igual fica null.
    for (const side of ["seller", "buyer"]) {
      await q.query(`UPDATE grain_contracts g SET ${side}_ids = sub.ids
        FROM (
          SELECT c.id, jsonb_agg(m.client_id ORDER BY e.ord) AS ids
            FROM grain_contracts c
            CROSS JOIN LATERAL jsonb_array_elements_text(CASE WHEN jsonb_typeof(c.${side}) = 'array' THEN c.${side} ELSE '[]'::jsonb END) WITH ORDINALITY AS e(name, ord)
            LEFT JOIN LATERAL (
              SELECT CASE WHEN COUNT(*) = 1 THEN MIN(cl.id) END AS client_id
                FROM clients cl
               WHERE cl.tenant_id = c.tenant_id
                 AND LOWER(TRIM(e.name)) IN (LOWER(TRIM(cl.name)), LOWER(TRIM(cl.nickname)))
            ) m ON true
           GROUP BY c.id
        ) sub
       WHERE sub.id = g.id AND (g.${side}_ids IS NULL OR g.${side}_ids = '[]'::jsonb)`);
    }

    // Fixações existentes: numera por contrato na ordem de data e lançamento.
    await q.query(`UPDATE contract_fixations f SET sequence = n.seq
      FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY tenant_id, contract_id ORDER BY fixation_date, created_at, id) AS seq
          FROM contract_fixations
      ) n
     WHERE n.id = f.id AND f.sequence IS NULL`);
  }

  public async down(q: QueryRunner): Promise<void> {
    for (const col of ["ppe", "fobbings", "conversion_factor", "sequence"]) {
      await q.query(`ALTER TABLE contract_fixations DROP COLUMN IF EXISTS ${col}`);
    }
    for (const col of ["payment_account", "buyer_ids", "seller_ids"]) {
      await q.query(`ALTER TABLE grain_contracts DROP COLUMN IF EXISTS ${col}`);
    }
    for (const col of ["zip_code", "state", "city", "district", "complement", "number", "address"]) {
      await q.query(`ALTER TABLE tenants DROP COLUMN IF EXISTS "${col}"`);
    }
  }
}
