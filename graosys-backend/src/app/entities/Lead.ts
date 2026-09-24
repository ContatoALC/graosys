import { Entity, Column, CreateDateColumn, PrimaryColumn, BeforeUpdate } from "typeorm";
import { v4 as uuid } from "uuid";

// Lead da prospecção da plataforma (não pertence a nenhuma corretora/tenant).
@Entity("leads")
export class Lead {
  @PrimaryColumn()
  id: string;

  @Column()
  name: string;

  @Column({ type: "varchar", nullable: true })
  region: string | null; // praças, ex: "Maringá-PR · Palmas-TO"

  @Column({ type: "varchar", default: "a_contatar" })
  status: string;

  @Column({ type: "varchar", nullable: true })
  probable_plan: string | null; // texto livre, ex: "Essencial ou Profissional"

  @Column({ type: "jsonb", default: [] })
  phones: { label: string; number: string }[];

  @Column({ type: "varchar", nullable: true })
  email: string | null;

  @Column({ type: "varchar", nullable: true })
  address: string | null;

  @Column({ type: "varchar", nullable: true })
  cnpj: string | null;

  @Column({ type: "varchar", nullable: true })
  corporate_name: string | null;

  @Column({ type: "varchar", nullable: true })
  site: string | null;

  @Column({ type: "text", nullable: true })
  hook: string | null; // gancho da primeira ligação

  @Column({ type: "varchar", nullable: true })
  decision_maker: string | null;

  @Column({ type: "varchar", nullable: true })
  whatsapp: string | null;

  @Column({ type: "varchar", nullable: true })
  next_step: string | null;

  @Column({ type: "date", nullable: true })
  next_step_date: string | null;

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
