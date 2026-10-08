import { Entity, Column, CreateDateColumn, PrimaryColumn, BeforeUpdate } from "typeorm";
import { v4 as uuid } from "uuid";

@Entity("brokers")
export class Broker {
  @PrimaryColumn()
  id: string;

  @Column()
  tenant_id: string;

  @Column()
  name: string;

  // Código do broker na corretora (ex.: "007"); é o que vai no "Nº Corretor/Broker" do contrato.
  @Column({ nullable: true })
  code: string | null;

  @Column({ nullable: true })
  cnpj_cpf: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ default: true })
  active: boolean;

  @Column({ type: "varchar", nullable: true })
  user_id: string | null; // usuário que faz login como este broker ("Minhas Comissões")

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
