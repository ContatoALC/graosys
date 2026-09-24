import { Entity, Column, CreateDateColumn, PrimaryColumn, BeforeUpdate } from "typeorm";
import { v4 as uuid } from "uuid";

@Entity("tenant_pdf_settings")
export class TenantPdfSettings {
  @PrimaryColumn()
  id: string;

  @Column({ unique: true })
  tenant_id: string;

  @Column({ type: "text", nullable: true })
  logo_data: string | null; // data URI (png/jpeg)

  @Column({ type: "varchar", default: "left" })
  logo_position: string; // left | center | right

  @Column({ type: "int", default: 120 })
  logo_width: number; // pontos (pt)

  @Column({ type: "text", nullable: true })
  watermark_data: string | null; // data URI (png/jpeg)

  @Column({ type: "float", default: 0.1 })
  watermark_opacity: number; // 0.05 - 0.5

  @Column({ default: false })
  watermark_enabled: boolean;

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
