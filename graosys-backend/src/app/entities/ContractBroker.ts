import { Entity, Column, CreateDateColumn, PrimaryColumn, Index } from "typeorm";
import { v4 as uuid } from "uuid";

// Brokers de um contrato e a parte de cada um na comissão da corretora.
@Entity("contract_brokers")
@Index(["tenant_id", "contract_id"])
@Index(["tenant_id", "broker_id"])
export class ContractBroker {
  @PrimaryColumn()
  id: string;

  @Column()
  tenant_id: string;

  @Column()
  contract_id: string;

  @Column()
  broker_id: string;

  @Column("decimal", { precision: 7, scale: 4, nullable: true })
  commission_percent: number | null; // % sobre a comissão do contrato; nulo = tabela do broker na data do contrato

  @CreateDateColumn()
  created_at: Date;

  constructor() {
    if (!this.id) this.id = uuid();
  }
}
