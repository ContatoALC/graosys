import { Entity, Column, CreateDateColumn, PrimaryColumn, BeforeUpdate } from "typeorm";
import { v4 as uuid } from "uuid";

// Recebimentos de comissões de contratos
@Entity("billings")
export class Billing {
  @PrimaryColumn()
  id: string;

  @Column()
  tenant_id: string;

  @Column()
  number_contract: string;

  @Column()
  number_broker: string;

  @Column()
  product_name: string;

  @Column()
  year: string;

  @Column({ nullable: true })
  receipt_date: string;

  @Column({ nullable: true })
  internal_receipt_number: string;

  @Column({ nullable: true })
  rps_number: string;

  @Column({ nullable: true })
  nfs_number: string;

  @Column("decimal", { precision: 15, scale: 4 })
  total_service_value: number;

  @Column("decimal", { precision: 15, scale: 4, default: 0 })
  irrf_value: number;

  @Column("decimal", { precision: 15, scale: 4, default: 0 })
  adjustment_value: number;

  @Column("decimal", { precision: 15, scale: 4 })
  liquid_value: number;

  @Column({ nullable: true })
  expected_receipt_date: string;

  @Column({ nullable: true })
  liquid_contract_date: string;

  @Column({ default: "pending" })
  status: string; // pending | received | cancelled

  @Column({ nullable: true })
  owner_record: string;

  @Column({ nullable: true })
  observation: string;

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
