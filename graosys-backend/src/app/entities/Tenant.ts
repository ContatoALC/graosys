import { Entity, Column, CreateDateColumn, PrimaryColumn, BeforeUpdate } from "typeorm";
import { v4 as uuid } from "uuid";

@Entity("tenants")
export class Tenant {
  @PrimaryColumn()
  id: string;

  @Column({ unique: true })
  slug: string; // ex: "fazenda-boa-esperanca"

  @Column()
  name: string; // ex: "Corretora Boa Esperança"

  @Column({ nullable: true })
  cnpj: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ default: "active" })
  status: string; // active | inactive | suspended

  @Column({ default: "trial" })
  plan: string; // trial | basic | pro | enterprise

  @Column({ nullable: true })
  plan_expires_at: Date;

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
