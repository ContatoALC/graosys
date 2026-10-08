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

  // Endereço da corretora, usado no cabeçalho dos contratos em PDF.
  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  number: string;

  @Column({ nullable: true })
  complement: string;

  @Column({ nullable: true })
  district: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  state: string;

  @Column({ nullable: true })
  zip_code: string;

  @Column({ default: "active" })
  status: string; // active | inactive | suspended

  @Column({ default: "trial" })
  plan: string; // trial | essencial | profissional | corporativo

  @Column({ nullable: true })
  plan_expires_at: Date;

  // full: Contratos → análise da Execução → envio. simple: corretora de um operador, sem a análise.
  @Column({ default: "full" })
  workflow_mode: string;

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
