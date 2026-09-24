import { Entity, Column, CreateDateColumn, PrimaryColumn, BeforeUpdate, Generated, Index } from "typeorm";
import { v4 as uuid } from "uuid";

@Entity("clients")
export class Client {
  @PrimaryColumn()
  id: string;

  @Column()
  tenant_id: string;

  @Index()
  @Generated("increment")
  @Column({ type: "int" })
  code_client: number;

  @Column()
  nickname: string;

  @Column()
  name: string;

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

  @Column({ type: "varchar", default: "Brasil" })
  country: string;

  @Column()
  kind: string; // PF | PJ

  @Column()
  cnpj_cpf: string;

  @Column({ nullable: true })
  ins_est: string;

  @Column({ nullable: true })
  ins_mun: string;

  @Column({ nullable: true })
  telephone: string;

  @Column({ nullable: true })
  cellphone: string;

  @Column({ default: "active" })
  situation: string; // active | inactive

  @Column({ type: "jsonb", nullable: true, default: [] })
  account: object[];

  @Column({ type: "jsonb", nullable: true, default: [] })
  contacts: object[];

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
