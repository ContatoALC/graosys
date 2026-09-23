import { Entity, Column, CreateDateColumn, PrimaryColumn, BeforeUpdate } from "typeorm";
import { v4 as uuid } from "uuid";

@Entity("tenant_email_settings")
export class TenantEmailSettings {
  @PrimaryColumn()
  id: string;

  @Column({ unique: true })
  tenant_id: string;

  @Column()
  smtp_host: string;

  @Column({ type: "int", default: 587 })
  smtp_port: number;

  @Column({ default: false })
  smtp_secure: boolean;

  @Column()
  smtp_user: string;

  @Column({ type: "text" })
  smtp_pass_encrypted: string;

  @Column({ nullable: true })
  from_name: string;

  @Column({ nullable: true })
  from_email: string;

  @Column({ type: "jsonb", nullable: true, default: [] })
  bcc_emails: string[];

  @Column({ type: "text", nullable: true })
  signature: string;

  @Column({ default: true })
  active: boolean;

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
