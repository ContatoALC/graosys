import { Entity, Column, CreateDateColumn, PrimaryColumn, BeforeUpdate } from "typeorm";
import { v4 as uuid } from "uuid";

@Entity("product_tables")
export class ProductTable {
  @PrimaryColumn()
  id: string;

  @Column()
  tenant_id: string;

  @Column()
  name: string;

  @Column()
  product: string;

  @Column()
  crop: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: "jsonb", nullable: true, default: [] })
  prices: {
    date: string;
    price: number;
    currency: string;
  }[];

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
