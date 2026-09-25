import { MigrationInterface, QueryRunner } from "typeorm";

export class AuditAndSessions1790294400002 implements MigrationInterface {
  name = "AuditAndSessions1790294400002";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS audit_logs (
      id character varying NOT NULL, tenant_id character varying, user_id character varying, user_name character varying,
      user_email character varying, action character varying NOT NULL, entity character varying, entity_id character varying,
      method character varying, path character varying, status_code integer, metadata jsonb NOT NULL DEFAULT '{}',
      ip character varying, user_agent character varying, created_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY (id))`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_898d14750b88319b89b1ab66cd" ON audit_logs (tenant_id, created_at)`);

    await q.query(`CREATE TABLE IF NOT EXISTS user_sessions (
      id character varying NOT NULL, tenant_id character varying NOT NULL, user_id character varying NOT NULL,
      user_name character varying NOT NULL, user_email character varying NOT NULL, role character varying NOT NULL,
      ip character varying, user_agent character varying, created_at timestamp NOT NULL DEFAULT now(),
      last_seen_at timestamp NOT NULL DEFAULT now(), expires_at timestamp NOT NULL, ended_at timestamp, ended_reason character varying,
      CONSTRAINT "PK_e93e031a5fed190d4789b6bfd83" PRIMARY KEY (id))`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_89b93a64cc85bdd4f2f6c99295" ON user_sessions (tenant_id, last_seen_at)`);
  }

  public async down(): Promise<void> {
    throw new Error("Migration não reversível: preserva a trilha de auditoria.");
  }
}
