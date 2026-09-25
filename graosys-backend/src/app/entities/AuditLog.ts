import { Entity, Column, CreateDateColumn, PrimaryColumn, Index } from "typeorm";
import { v4 as uuid } from "uuid";

// Trilha de auditoria: somente inserção (não há rota de edição ou exclusão).
@Entity("audit_logs")
@Index(["tenant_id", "created_at"])
export class AuditLog {
  @PrimaryColumn()
  id: string;

  @Column({ type: "varchar", nullable: true })
  tenant_id: string | null; // nulo em tentativas de login de e-mail desconhecido

  @Column({ type: "varchar", nullable: true })
  user_id: string | null;

  @Column({ type: "varchar", nullable: true })
  user_name: string | null;

  @Column({ type: "varchar", nullable: true })
  user_email: string | null;

  @Column()
  action: string; // ex.: contracts.create, auth.login_failed

  @Column({ type: "varchar", nullable: true })
  entity: string | null;

  @Column({ type: "varchar", nullable: true })
  entity_id: string | null;

  @Column({ type: "varchar", nullable: true })
  method: string | null;

  @Column({ type: "varchar", nullable: true })
  path: string | null;

  @Column({ type: "int", nullable: true })
  status_code: number | null;

  @Column({ type: "jsonb", default: {} })
  metadata: Record<string, unknown>; // nomes dos campos alterados; nunca valores sensíveis

  @Column({ type: "varchar", nullable: true })
  ip: string | null;

  @Column({ type: "varchar", nullable: true })
  user_agent: string | null;

  @CreateDateColumn()
  created_at: Date;

  constructor() {
    if (!this.id) this.id = uuid();
  }
}
