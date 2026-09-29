import { Entity, Column, CreateDateColumn, PrimaryColumn, Index } from "typeorm";
import { v4 as uuid } from "uuid";

// Tabela de comissão do broker com vigência: vale o % com a maior data de início até a data do contrato.
// Um aumento (ex.: 0,25% → 0,50% a partir de 01/12) não muda contratos anteriores.
@Entity("broker_commission_rates")
@Index(["tenant_id", "broker_id"])
export class BrokerCommissionRate {
  @PrimaryColumn()
  id: string;

  @Column()
  tenant_id: string;

  @Column()
  broker_id: string;

  @Column("decimal", { precision: 7, scale: 4 })
  percent: number; // % sobre a comissão da corretora

  @Column({ type: "varchar" })
  valid_from: string; // AAAA-MM-DD

  @Column({ type: "varchar", nullable: true })
  created_by_name: string | null;

  @CreateDateColumn()
  created_at: Date;

  constructor() {
    if (!this.id) this.id = uuid();
  }
}
