import { Entity, Column, CreateDateColumn, PrimaryColumn, BeforeUpdate, ManyToOne, JoinColumn } from "typeorm";
import { v4 as uuid } from "uuid";
import { Tenant } from "./Tenant";

@Entity("users")
export class User {
  @PrimaryColumn()
  id: string;

  @Column()
  tenant_id: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: "tenant_id" })
  tenant: Tenant;

  @Column()
  name: string;

  @Column({ unique: false })
  email: string;

  @Column()
  password: string;

  @Column({ default: "user" })
  role: string; // superadmin | admin | user

  @Column({ type: "jsonb", nullable: true, default: {} })
  permissions: Record<string, string[]>;

  @Column({ default: true })
  active: boolean;

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
