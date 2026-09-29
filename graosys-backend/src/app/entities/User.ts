import { Entity, Column, CreateDateColumn, PrimaryColumn, BeforeUpdate, ManyToOne, JoinColumn, Index } from "typeorm";
import { v4 as uuid } from "uuid";
import { Tenant } from "./Tenant";

@Entity("users")
// Índice único em LOWER(email), criado pela migration AccountSecurity (expressão: fora do sync do TypeORM).
@Index("UQ_users_email_lower", { synchronize: false })
export class User {
  @PrimaryColumn()
  id: string;

  @Column()
  tenant_id: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: "tenant_id" })
  tenant: Tenant;

  @Column()
  name: string;

  @Column({ unique: false })
  email: string;

  @Column({ select: false })
  password: string;

  @Column({ default: "user" })
  role: string; // superadmin | admin | user

  @Column({ type: "jsonb", nullable: true, default: {} })
  permissions: Record<string, string[]>;

  @Column({ default: true })
  active: boolean;

  @Column({ type: "timestamp", nullable: true })
  last_login_at: Date | null;

  @Column({ type: "varchar", nullable: true, select: false })
  reset_token_hash: string | null; // sha256 do token de "esqueci minha senha"

  @Column({ type: "timestamp", nullable: true, select: false })
  reset_token_expires_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP", onUpdate: "CURRENT_TIMESTAMP" })
  updated_at: Date;

  @BeforeUpdate()
  updateTimestamp() {
    this.updated_at = new Date();
  }

  constructor() {
    if (!this.id) this.id = uuid();
  }
}
