import { MigrationInterface, QueryRunner } from "typeorm";

export class AccountSecurity1790294400005 implements MigrationInterface {
  name = "AccountSecurity1790294400005";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE users
      ADD COLUMN IF NOT EXISTS reset_token_hash character varying,
      ADD COLUMN IF NOT EXISTS reset_token_expires_at timestamp`);

    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_audit_logs_action_created" ON audit_logs (action, created_at)`);

    // E-mails em minúsculas, para o login e a unicidade não dependerem de maiúsculas.
    await q.query(`UPDATE users SET email = LOWER(TRIM(email)) WHERE email <> LOWER(TRIM(email))`);

    // Unicidade só é criada se não houver e-mails repetidos; se houver, o deploy segue e avisa no log
    // (o login já trata repetidos pela senha). Resolva os repetidos e rode de novo com uma migration nova.
    await q.query(`DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM users GROUP BY LOWER(email) HAVING count(*) > 1) THEN
          RAISE WARNING 'E-mails repetidos em users: índice UQ_users_email_lower NÃO criado.';
        ELSE
          CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_email_lower" ON users (LOWER(email));
        END IF;
      END $$`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "UQ_users_email_lower"`);
    await q.query(`DROP INDEX IF EXISTS "IDX_audit_logs_action_created"`);
    await q.query(`ALTER TABLE users DROP COLUMN IF EXISTS reset_token_expires_at, DROP COLUMN IF EXISTS reset_token_hash`);
  }
}
