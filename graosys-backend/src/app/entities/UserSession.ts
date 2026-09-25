import { Entity, Column, CreateDateColumn, PrimaryColumn, Index } from "typeorm";

// Sessão de login (o id é o "sid" dentro do JWT). "Online" = batimento recente e sem encerramento.
@Entity("user_sessions")
@Index(["tenant_id", "last_seen_at"])
export class UserSession {
  @PrimaryColumn()
  id: string;

  @Column()
  tenant_id: string;

  @Column()
  user_id: string;

  @Column()
  user_name: string;

  @Column()
  user_email: string;

  @Column()
  role: string;

  @Column({ type: "varchar", nullable: true })
  ip: string | null;

  @Column({ type: "varchar", nullable: true })
  user_agent: string | null;

  @CreateDateColumn()
  created_at: Date;

  @Column({ type: "timestamp", default: () => "now()" })
  last_seen_at: Date;

  @Column({ type: "timestamp" })
  expires_at: Date;

  @Column({ type: "timestamp", nullable: true })
  ended_at: Date | null;

  @Column({ type: "varchar", nullable: true })
  ended_reason: string | null; // logout
}
