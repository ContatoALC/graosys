import { AppDataSource } from "../database/data-source";

const TZ = "America/Sao_Paulo";
// Frontend envia batimento a cada 60 s; 2 min sem batimento = fora do ar.
const ONLINE = `ended_at IS NULL AND expires_at > now() AND last_seen_at > now() - interval '2 minutes'`;

// tenantId nulo = visão da plataforma (todas as corretoras). Toda consulta de corretora filtra por tenant.
export async function sessionsOverview(tenantId: string | null) {
  const scope = tenantId ? "AND tenant_id = $1" : "";
  const params = tenantId ? [tenantId] : [];
  const db = AppDataSource;

  const [kpis] = await db.query(
    `SELECT
       count(*) FILTER (WHERE ${ONLINE}) AS online,
       count(*) FILTER (WHERE (created_at AT TIME ZONE 'UTC' AT TIME ZONE '${TZ}')::date = (now() AT TIME ZONE '${TZ}')::date) AS logins_today,
       count(DISTINCT user_id) FILTER (WHERE created_at > now() - interval '7 days') AS active_users_7d,
       count(*) FILTER (WHERE created_at > now() - interval '7 days') AS sessions_7d
     FROM user_sessions WHERE true ${scope}`,
    params
  );

  const [failed] = await db.query(
    `SELECT count(*) AS n FROM audit_logs WHERE action = 'auth.login_failed' AND created_at > now() - interval '7 days' ${scope}`,
    params
  );

  const online = await db.query(
    `SELECT id, tenant_id, user_name, user_email, role, ip, user_agent, created_at, last_seen_at
     FROM user_sessions WHERE ${ONLINE} ${scope} ORDER BY last_seen_at DESC LIMIT 200`,
    params
  );

  const byDay = await db.query(
    `SELECT to_char(d::date, 'YYYY-MM-DD') AS day, coalesce(s.logins, 0)::int AS logins, coalesce(s.users, 0)::int AS users
     FROM generate_series((now() AT TIME ZONE '${TZ}')::date - 13, (now() AT TIME ZONE '${TZ}')::date, interval '1 day') d
     LEFT JOIN (
       SELECT (created_at AT TIME ZONE 'UTC' AT TIME ZONE '${TZ}')::date AS day, count(*) AS logins, count(DISTINCT user_id) AS users
       FROM user_sessions WHERE created_at > now() - interval '15 days' ${scope} GROUP BY 1
     ) s ON s.day = d::date ORDER BY d`,
    params
  );

  const recent = await db.query(
    `SELECT id, tenant_id, user_name, user_email, role, ip, user_agent, created_at, last_seen_at, ended_at, ended_reason,
       CASE WHEN ended_at IS NOT NULL THEN 'ended'
            WHEN expires_at <= now() THEN 'expired'
            WHEN last_seen_at > now() - interval '2 minutes' THEN 'online'
            ELSE 'inactive' END AS status
     FROM user_sessions WHERE true ${scope} ORDER BY created_at DESC LIMIT 50`,
    params
  );

  const byTenant = tenantId
    ? []
    : await db.query(
        `SELECT t.id AS tenant_id, t.name, count(*) FILTER (WHERE ${ONLINE.replace(/(\w+) (IS|>)/g, "s.$1 $2")}) AS online, count(s.id) FILTER (WHERE s.created_at > now() - interval '7 days') AS sessions_7d
         FROM tenants t LEFT JOIN user_sessions s ON s.tenant_id = t.id GROUP BY t.id, t.name ORDER BY online DESC, sessions_7d DESC`
      );

  const num = (v: unknown) => Number(v ?? 0);
  return {
    kpis: {
      online: num(kpis.online), logins_today: num(kpis.logins_today), active_users_7d: num(kpis.active_users_7d),
      sessions_7d: num(kpis.sessions_7d), failed_logins_7d: num(failed.n),
    },
    online, by_day: byDay, recent,
    by_tenant: byTenant.map((r: any) => ({ ...r, online: num(r.online), sessions_7d: num(r.sessions_7d) })),
  };
}
