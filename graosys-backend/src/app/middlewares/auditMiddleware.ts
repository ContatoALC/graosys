import { Request, Response, NextFunction } from "express";
import { writeAudit, clientIp, userAgent } from "../../services/audit";

const ID_LIKE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+)$/i;
const VERB: Record<string, string> = { POST: "create", PUT: "update", PATCH: "update", DELETE: "delete" };

// Nomes amigáveis para ações especiais; as demais seguem "<recurso>.<create|update|delete>".
const FRIENDLY: Record<string, string> = {
  "contracts.clone.create": "contracts.clone",
  "contracts.status.update": "contracts.status_change",
  "email.send-contract.create": "contracts.email_send",
  "email.send-custom.create": "email.send_custom",
  "auth.reset-password.create": "auth.password_reset",
  "auth.heartbeat.create": "",
  "auth.logout.create": "",
  "email-settings.test.create": "email_settings.test",
  "pdf-settings.update": "pdf_settings.update",
};

// Grava uma linha por requisição que altera dados, ao final da resposta e antes de liberá-la
// (em serverless a função pode congelar logo após responder).
export function auditMiddleware(req: Request, res: Response, next: NextFunction) {
  const verb = VERB[req.method];
  if (!verb) return next();

  let responseBody: any;
  const originalJson = res.json.bind(res);
  res.json = (body: any) => { responseBody = body; return originalJson(body); };

  const originalEnd = res.end.bind(res) as (...args: any[]) => Response;
  res.end = ((...args: any[]) => {
    const flush = async () => {
      const segs = req.path.replace(/^\/api\//, "").split("/").filter(Boolean);
      const named = segs.filter((s) => !ID_LIKE.test(s));
      const key = `${named.join(".")}.${verb}`;
      const action = key in FRIENDLY ? FRIENDLY[key] : key;
      if (action) {
        const idFromPath = segs.find((s) => ID_LIKE.test(s));
        const body = (req.body && typeof req.body === "object") ? req.body : {};
        await writeAudit({
          tenant_id: req.user?.tenant_id ?? null,
          user_id: req.user?.id ?? null,
          user_name: req.user?.name ?? null,
          user_email: req.user?.email ?? null,
          action,
          entity: named[0] === "platform" ? `platform.${named[1] ?? ""}` : named[0] ?? null,
          entity_id: req.params?.id ?? idFromPath ?? (typeof responseBody?.id === "string" ? responseBody.id : null),
          method: req.method,
          path: req.path.slice(0, 255),
          status_code: res.statusCode,
          // Só nomes dos campos enviados: valores podem conter dados pessoais ou segredos.
          metadata: {
            fields: Object.keys(body).slice(0, 60),
            ...(typeof body.status === "string" && action === "contracts.status_change" ? { status: body.status } : {}),
          },
          ip: clientIp(req),
          user_agent: userAgent(req),
        });
      }
      originalEnd(...args);
    };
    void flush();
    return res;
  }) as any;

  return next();
}
