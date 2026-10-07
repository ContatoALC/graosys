/**
 * Registro de TODAS as rotas do app (src/Routes.tsx).
 *
 * O teste tests/public/route-coverage.spec.ts compara este arquivo com o
 * Routes.tsx: se alguém criar uma rota nova e não registrar aqui, o CI quebra.
 *
 * - Rotas estáticas são abertas automaticamente por tests/app/routes.spec.ts.
 * - Rotas com parâmetro (":id") precisam de `coveredBy` (spec que as testa)
 *   ou de `pending` (motivo) — pending aparece como "fixme" no relatório.
 */
export type AppRoute = {
  path: string;
  /** Título (h1) esperado na tela, quando a página usa PageHeader. */
  heading?: string;
  /** Rota pública (sem login). */
  public?: boolean;
  /** Rota que só redireciona (ex.: "/" → "/dashboard"). */
  redirectsTo?: string;
  /** Spec que cobre uma rota dinâmica. */
  coveredBy?: string;
  /** Motivo de ainda não haver teste — vira test.fixme. */
  pending?: string;
};

export const ROUTES: AppRoute[] = [
  // Públicas
  { path: "/login", public: true },
  { path: "/forgot-password", public: true },
  { path: "/reset-password", public: true },

  // App
  { path: "/", redirectsTo: "/dashboard" },
  { path: "/dashboard", heading: "Dashboard" },
  { path: "/contracts" },
  { path: "/contracts/new" },
  { path: "/contracts/:id", coveredBy: "tests/app/contracts.spec.ts" },
  { path: "/clients" },
  { path: "/clients/new" },
  { path: "/clients/:id", coveredBy: "tests/app/clients.spec.ts" },
  { path: "/execution", heading: "Execução" },
  { path: "/billing", redirectsTo: "/billing/receipt" },
  { path: "/billing/receipt" },
  { path: "/management", heading: "Gerência" },
  { path: "/reports" },
  { path: "/admin" },
  { path: "/admin/users", heading: "Usuários" },
  { path: "/admin/access", heading: "Controle de Acesso" },
  { path: "/admin/products", heading: "Produtos" },
  { path: "/admin/brokers", heading: "Corretores/Brokers" },
  { path: "/admin/email", heading: "E-mail da Corretora" },
  { path: "/admin/pdf-layout", heading: "Layout do PDF" },
  { path: "/admin/audit", heading: "Auditoria" },
  { path: "/admin/sessions", heading: "Usuários Online" },
  { path: "/admin/tables" },
  { path: "/platform", heading: "Painel de Controle" },
  { path: "/platform/audit", heading: "Painel de Controle" },
  { path: "/platform/sessions", heading: "Painel de Controle" },
  { path: "/platform/leads", heading: "Painel de Controle" },
  { path: "/platform/volume", heading: "Painel de Controle", coveredBy: "tests/app/platform-volume.spec.ts" },
  { path: "/platform/leads/:id", coveredBy: "tests/app/leads.spec.ts" },
  { path: "/platform/tenants/:id", coveredBy: "tests/app/platform.spec.ts" },
  { path: "/my-account", heading: "Minha Conta" },
  { path: "/broker-commissions" },
];
