import { Entity, Column, CreateDateColumn, PrimaryColumn, Index } from "typeorm";
import { v4 as uuid } from "uuid";

// Uma fixação de preço (total ou parcial) de um contrato "a fixar".
@Entity("contract_fixations")
@Index(["tenant_id", "contract_id"])
export class ContractFixation {
  @PrimaryColumn()
  id: string;

  @Column()
  tenant_id: string;

  @Column()
  contract_id: string;

  @Column({ type: "varchar" })
  fixation_date: string; // AAAA-MM-DD

  @Column("decimal", { precision: 15, scale: 4 })
  quantity: number; // na unidade do contrato

  @Column({ type: "varchar" })
  mode: string; // market | frame

  @Column("decimal", { precision: 15, scale: 4, nullable: true })
  chicago: number | null; // centavos de dólar por bushel

  @Column("decimal", { precision: 15, scale: 4, nullable: true })
  premium: number | null; // centavos de dólar por bushel

  @Column("decimal", { precision: 15, scale: 6, nullable: true })
  exchange_rate: number | null; // R$ por US$

  @Column("decimal", { precision: 15, scale: 4 })
  price: number; // por unidade do contrato, na moeda do contrato

  @Column({ type: "varchar", nullable: true })
  notes: string | null;

  @Column({ type: "varchar", nullable: true })
  created_by_id: string | null;

  @Column({ type: "varchar", nullable: true })
  created_by_name: string | null;

  @CreateDateColumn()
  created_at: Date;

  constructor() {
    if (!this.id) this.id = uuid();
  }
}
