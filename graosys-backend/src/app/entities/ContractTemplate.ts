import { Entity, Column, CreateDateColumn, PrimaryColumn, BeforeUpdate, Index } from "typeorm";
import { v4 as uuid } from "uuid";
import type { TemplateClause, TemplateField } from "../../services/contractTemplates";

// Modelo de contrato da corretora (idioma, campos, cláusulas e visual do PDF). Um por corretora é o padrão.
@Entity("contract_templates")
@Index(["tenant_id"])
@Index("UQ_contract_templates_default", { synchronize: false }) // único por corretora WHERE is_default (só na migration)
export class ContractTemplate {
  @PrimaryColumn()
  id: string;

  @Column()
  tenant_id: string;

  @Column()
  name: string;

  @Column({ type: "varchar", default: "pt-BR" })
  language: string; // pt-BR | en

  @Column({ default: false })
  is_default: boolean;

  @Column({ default: true })
  active: boolean; // false = arquivado: some do seletor, mas os contratos que o usam continuam gerando PDF

  @Column()
  title: string;

  @Column({ type: "jsonb", default: [] })
  fields: TemplateField[];

  @Column({ default: true })
  show_fixations: boolean;

  @Column({ type: "jsonb", default: [] })
  clauses: TemplateClause[];

  @Column({ type: "text", default: "" })
  closing_text: string;

  @Column({ type: "jsonb", default: [] })
  signatures: string[];

  @Column({ type: "text", nullable: true })
  logo_data: string | null; // data URI (png/jpeg)

  @Column({ type: "varchar", default: "left" })
  logo_position: string; // left | center | right

  @Column({ type: "int", default: 120 })
  logo_width: number; // pontos (pt)

  @Column({ type: "text", nullable: true })
  watermark_data: string | null; // data URI (png/jpeg)

  @Column({ type: "float", default: 0.1 })
  watermark_opacity: number;

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
