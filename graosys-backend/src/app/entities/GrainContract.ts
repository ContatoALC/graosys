import { Entity, Column, CreateDateColumn, PrimaryColumn, BeforeUpdate } from "typeorm";
import { v4 as uuid } from "uuid";

@Entity("grain_contracts")
export class GrainContract {
  @PrimaryColumn()
  id: string;

  @Column()
  tenant_id: string;

  @Column()
  number_broker: string;

  @Column()
  number_contract: string;

  @Column({ type: "jsonb", nullable: true, default: [] })
  seller: string[];

  @Column({ type: "jsonb", nullable: true, default: [] })
  buyer: string[];

  @Column({ type: "jsonb", nullable: true, default: [] })
  list_email_seller: string[];

  @Column({ type: "jsonb", nullable: true, default: [] })
  list_email_buyer: string[];

  @Column()
  product: string;

  @Column()
  name_product: string;

  @Column()
  crop: string; // safra ex: "2024/2025"

  @Column({ nullable: true })
  quality: string;

  @Column({ nullable: true })
  type_quantity: string; // kg | sc | ton

  @Column("decimal", { precision: 15, scale: 4 })
  quantity: number;

  @Column("decimal", { precision: 15, scale: 4, nullable: true })
  quantity_kg: number;

  @Column("decimal", { precision: 15, scale: 4, nullable: true })
  quantity_bag: number;

  @Column()
  type_currency: string; // BRL | USD

  @Column("decimal", { precision: 15, scale: 4 })
  price: number;

  // Contrato a fixar: preço final definido por fixações posteriores (modalidades "market" ou "frame").
  @Column({ type: "varchar", default: "fixed" })
  price_type: string; // fixed | to_fix

  @Column({ type: "varchar", nullable: true })
  fixation_mode: string | null; // market | frame

  @Column({ type: "varchar", nullable: true })
  cbot_reference: string | null; // ex.: SX26

  @Column({ type: "varchar", nullable: true })
  fixation_deadline: string | null; // AAAA-MM-DD

  @Column("decimal", { precision: 15, scale: 4, nullable: true })
  frame_chicago: number | null; // já travado no contrato (c/bu); nulo = a fixar

  @Column("decimal", { precision: 15, scale: 4, nullable: true })
  frame_premium: number | null;

  @Column("decimal", { precision: 15, scale: 6, nullable: true })
  frame_exchange: number | null;

  @Column("decimal", { precision: 15, scale: 4, default: 0 })
  fixed_quantity: number;

  @Column({ nullable: true })
  type_icms: string;

  @Column({ nullable: true })
  icms: string;

  @Column({ nullable: true })
  payment: string;

  @Column({ nullable: true })
  type_commission_seller: string; // % | R$/sc | R$/ton

  @Column({ nullable: true })
  commission_seller: string;

  @Column({ nullable: true })
  type_commission_buyer: string;

  @Column({ nullable: true })
  commission_buyer: string;

  @Column({ nullable: true })
  type_pickup: string;

  @Column({ nullable: true })
  pickup: string;

  @Column({ nullable: true })
  pickup_location: string;

  @Column({ nullable: true })
  inspection: string;

  @Column({ nullable: true })
  observation: string;

  @Column({ nullable: true })
  internal_communication: string;

  @Column({ nullable: true })
  destination: string;

  @Column({ nullable: true })
  complement_destination: string;

  @Column({ nullable: true })
  number_external_contract_buyer: string;

  @Column({ nullable: true })
  number_external_contract_seller: string;

  @Column({ nullable: true })
  day_exchange_rate: string;

  @Column({ nullable: true })
  payment_date: string;

  @Column({ nullable: true })
  initial_pickup_date: string;

  @Column({ nullable: true })
  final_pickup_date: string;

  @Column({ nullable: true })
  contract_emission_date: string;

  @Column({ nullable: true })
  owner_contract: string;

  @Column("decimal", { precision: 15, scale: 4, nullable: true })
  total_contract_value: number;

  @Column("decimal", { precision: 15, scale: 4, nullable: true })
  commission_contract: number;

  @Column("decimal", { precision: 15, scale: 4, nullable: true })
  commission_seller_contract_value: number;

  @Column("decimal", { precision: 15, scale: 4, nullable: true })
  commission_buyer_contract_value: number;

  @Column("decimal", { precision: 15, scale: 4, nullable: true })
  total_received: number;

  @Column({ nullable: true })
  status_received: string;

  @Column({ nullable: true })
  expected_receipt_date: string;

  @Column({ type: "jsonb", nullable: true })
  status: {
    status_current: string;
    history: {
      date: string;
      time: string;
      status: string;
      owner_change: string;
    }[];
  };

  @Column({ nullable: true, type: "uuid" })
  table_id: string;

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
