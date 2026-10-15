import { Entity, Column, CreateDateColumn, PrimaryColumn, BeforeUpdate } from "typeorm";
import { v4 as uuid } from "uuid";

@Entity("products")
export class Product {
  @PrimaryColumn()
  id: string;

  @Column()
  tenant_id: string;

  @Column()
  product_type: string; // código único dentro do tenant

  @Column()
  name: string;

  @Column({ nullable: true })
  commission_seller: string;

  @Column({ nullable: true })
  type_commission_seller: string;

  @Column({ type: "text", nullable: true })
  quality: string;

  @Column({ type: "text", nullable: true })
  observation: string;

  // Modelo de contrato que já vem escolhido no contrato novo deste produto; nulo = padrão da corretora.
  @Column({ type: "varchar", nullable: true })
  template_id: string | null;

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
