# GraoSys — Backend

API do GraoSys, um SaaS multi-tenant para corretoras de grãos: gestão de contratos, clientes,
recebimentos (cobrança), produtos/mesas de preço e usuários por corretora (tenant).

## Stack

- Node.js + Express + TypeScript
- TypeORM sobre PostgreSQL
- Autenticação via JWT (stateless, sem sessão em banco)
- Multi-tenancy por coluna `tenant_id` em cada tabela, aplicado manualmente em cada query
- Envio de e-mail via Nodemailer (SMTP)
- Deploy: Vercel (função serverless em `api/index.ts`)

## Requisitos

- Node.js 18+
- PostgreSQL 13+

## Configuração

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Copie o arquivo de exemplo de variáveis de ambiente e ajuste os valores:

   ```bash
   cp .env.example .env
   ```

3. Suba um PostgreSQL local (ou aponte para um existente) e garanta que o banco definido em
   `TYPEORM_DATABASE` exista.

4. Rode em modo desenvolvimento (schema sincronizado automaticamente pelo TypeORM, sem
   necessidade de migrations em dev):

   ```bash
   npm run dev
   ```

   A API sobe em `http://localhost:3333` (ou na porta definida em `PORT`).

### Variáveis de ambiente

| Variável | Descrição | Obrigatória |
|---|---|---|
| `PORT` | Porta HTTP do servidor | Não (default `3333`) |
| `NODE_ENV` | `development` \| `production` | Não |
| `FRONTEND_URL` | Origem permitida no CORS (com credentials). Sem ela, o CORS reflete a origem da requisição sem credentials | Recomendada em produção |
| `TYPEORM_HOST` / `TYPEORM_PORT` / `TYPEORM_USERNAME` / `TYPEORM_PASSWORD` / `TYPEORM_DATABASE` | Conexão direta com Postgres (dev local) | Sim, se não usar `DATABASE_URL` |
| `DATABASE_URL` / `POSTGRES_URL` | Connection string completa (Vercel Postgres/Neon/Supabase). Tem prioridade sobre as `TYPEORM_*` | Alternativa às `TYPEORM_*` |
| `TYPEORM_SSL` | `false` desliga SSL na conexão direta; qualquer outro valor habilita SSL com `rejectUnauthorized: false` | Não |
| `JWT_SECRET` | Segredo de assinatura dos tokens JWT | **Sim, em produção** (ver nota de segurança) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` | Credenciais SMTP usadas para envio de e-mails de contrato e e-mails customizados | Sim, se for usar os endpoints `/api/email/*` |

> **Segurança:** em `NODE_ENV=production`, o servidor recusa subir (`validateEnv()`,
> `src/config/validateEnv.ts`) se `JWT_SECRET` estiver ausente/curto ou se a credencial de
> banco estiver ausente ou for um valor padrão conhecido (ex.: `postgres`/`postgres`). Gere um
> `JWT_SECRET` forte e único por ambiente antes de fazer deploy.

## Scripts

| Comando | Descrição |
|---|---|
| `npm run dev` | Sobe a API em modo desenvolvimento com reload automático (`ts-node-dev`) |
| `npm run build` | Compila o TypeScript para `build/` |
| `npm start` | Roda a versão compilada (`build/server.js`) |
| `npm run migration:create -- NomeDaMigration` | Cria uma nova migration |
| `npm run migration:run` | Executa migrations pendentes |
| `npm run migration:revert` | Desfaz a última migration |

Em desenvolvimento (`NODE_ENV !== "production"`), o TypeORM usa `synchronize: true` e cria/ajusta
o schema automaticamente a partir das entidades — não é necessário rodar migrations localmente.
Em produção, `synchronize` fica desligado e o schema deve ser gerido por migrations.

## Estrutura

```
src/
  app.ts                  # Configuração do Express (CORS, JSON, rotas, error handler)
  server.ts               # Bootstrap local (valida env, conecta no banco, sobe o servidor)
  config/
    validateEnv.ts        # Validação de variáveis sensíveis em produção
    jwtSecret.ts           # Resolução do segredo JWT (com fallback só em dev)
  database/
    data-source.ts        # DataSource do TypeORM (Postgres)
  utils/
    pickFields.ts          # Whitelist de campos para evitar mass assignment
  app/
    entities/              # Entidades TypeORM (Tenant, User, Client, GrainContract, Billing, Product, ProductTable)
    controllers/            # Um controller por recurso
    middlewares/
      authMiddleware.ts      # authMiddleware (JWT), requireRole, requirePermission
      errorMiddleware.ts      # Handler de erros (não expõe detalhes internos ao cliente)
    routes/index.ts          # Todas as rotas da API
api/index.ts                # Entry point da função serverless (Vercel)
```

## Modelo de autorização

- **Autenticação:** JWT assinado no login (`POST /api/auth/login`), enviado como
  `Authorization: Bearer <token>`. `authMiddleware` valida o token em todas as rotas, exceto
  login e registro de tenant.
- **Papéis:** cada usuário tem `role` (`admin` ou `user`). Rotas administrativas (gestão de
  usuários, produtos, mesas de preço, dados do tenant, deleções) exigem `requireRole("admin")`.
- **Permissões granulares:** usuários não-admin têm um mapa `permissions` (por módulo —
  `contracts`, `clients`, `execution`, `billing`, `reports` — e ação — `view`/`create`/`edit`/
  `delete`), configurado pelo admin em `/admin/access` no frontend e aplicado via
  `requirePermission(module, action)` nas rotas correspondentes. Um usuário admin sempre passa
  por essa checagem.
- **Isolamento de tenant:** toda query de leitura/escrita filtra por
  `tenant_id: req.user.tenant_id` (extraído do JWT, nunca de input do cliente).

## Principais rotas

| Método | Rota | Observação |
|---|---|---|
| `POST` | `/api/auth/login` | Público |
| `POST` | `/api/tenants/register` | Público — cadastro de nova corretora + usuário admin |
| `POST` | `/api/auth/reset-password` | Requer senha atual |
| `GET` | `/api/dashboard/summary` | KPIs do tenant logado |
| `GET/POST/PATCH/DELETE` | `/api/clients`, `/api/contracts`, `/api/billings` | Escopados por permissão de módulo; delete exige admin |
| `GET/POST/PATCH/DELETE` | `/api/users`, `/api/products`, `/api/product-tables` | Exigem `role: admin` |
| `POST` | `/api/email/send-contract` | Envia e-mail de contrato ao vendedor/comprador |
| `POST` | `/api/email/send-custom` | Exige `role: admin`; HTML sanitizado antes do envio |

## Auditoria de segurança

Um relatório completo de auditoria de segurança (achados, correções aplicadas e issues
sugeridas) está em [`docs/security-audit/`](../docs/security-audit/), na raiz do monorepo.
