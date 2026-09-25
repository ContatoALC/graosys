const ACTIONS: Record<string, string> = {
  "auth.login": "Login", "auth.login_failed": "Falha de login", "auth.logout": "Logout", "auth.password_reset": "Senha alterada",
  "contracts.create": "Contrato criado", "contracts.update": "Contrato editado", "contracts.delete": "Contrato excluído",
  "contracts.clone": "Contrato clonado", "contracts.fixation_add": "Fixação de preço lançada", "contracts.fixation_remove": "Fixação de preço excluída", "contracts.status_change": "Status do contrato alterado", "contracts.email_send": "Contrato enviado por e-mail",
  "clients.create": "Cliente criado", "clients.update": "Cliente editado", "clients.delete": "Cliente excluído",
  "billings.create": "Recebimento criado", "billings.update": "Recebimento editado", "billings.delete": "Recebimento excluído",
  "products.create": "Produto criado", "products.update": "Produto editado", "products.delete": "Produto excluído",
  "brokers.create": "Broker criado", "brokers.update": "Broker editado", "brokers.delete": "Broker excluído",
  "users.create": "Usuário criado", "users.update": "Usuário editado", "users.delete": "Usuário excluído",
  "product-tables.create": "Mesa criada", "product-tables.update": "Mesa editada", "product-tables.delete": "Mesa excluída",
  "email-settings.update": "E-mail da corretora alterado", "email_settings.test": "Teste de e-mail", "pdf_settings.update": "Layout do PDF alterado",
  "tenant.update": "Dados da corretora alterados",
};

export function actionLabel(action: string) {
  return ACTIONS[action] ?? action;
}

export function parseUserAgent(ua?: string | null) {
  if (!ua) return "—";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Navegador";
  const os = /Windows/.test(ua) ? "Windows" : /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} · ${os}` : browser;
}

export const fmtDateTime = (v?: string | null) => (v ? new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" }) : "—");

export function duration(from: string, to?: string | null) {
  const ms = new Date(to ?? Date.now()).getTime() - new Date(from).getTime();
  const min = Math.max(0, Math.round(ms / 60000));
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
}
