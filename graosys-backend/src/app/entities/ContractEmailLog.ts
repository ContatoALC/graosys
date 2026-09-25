import { Entity, Column, CreateDateColumn, PrimaryColumn, Index } from "typeorm";
import { v4 as uuid } from "uuid";

// Registro de cada envio de contrato por e-mail (um por lado: vendedor ou comprador).
@Entity("contract_email_logs")
@Index(["tenant_id", "contract_id"])
export class ContractEmailLog {
  @PrimaryColumn()
  id: string;

  @Column()
  tenant_id: string;

  @Column()
  contract_id: string;

  @Column()
  party: string; // seller | buyer

  @Column({ type: "text", nullable: true })
  party_names: string | null;

  @Column({ type: "jsonb", default: [] })
  recipients: string[];

  @Column({ type: "varchar", nullable: true })
  subject: string | null;

  @Column({ default: false })
  copy_correct: boolean;

  @Column({ default: "sent" })
  status: string; // sent | failed

  @Column({ type: "text", nullable: true })
  error: string | null;

  @Column({ type: "varchar", nullable: true })
  sent_by_id: string | null;

  @Column({ type: "varchar", nullable: true })
  sent_by_name: string | null;

  @Column({ type: "varchar", nullable: true })
  sent_by_email: string | null;

  @CreateDateColumn()
  sent_at: Date;

  constructor() {
    if (!this.id) this.id = uuid();
  }
}
