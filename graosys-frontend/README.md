# GraoSys — Frontend

Interface web do GraoSys, SaaS multi-tenant para corretoras de grãos: contratos, clientes,
execução (acompanhamento de status), cobrança, produtos e administração por corretora.

## Stack

- React 18 + TypeScript + Vite
- React Router (rotas privadas e administrativas)
- Tailwind CSS + componentes baseados em Radix UI (padrão shadcn/ui)
- React Hook Form + Zod (formulários e validação)
- Axios (HTTP client)
- Recharts (gráficos do dashboard), jsPDF/xlsx (exportação de relatórios)
- Deploy: Vercel (SPA estática, rewrites em `vercel.json`)

## Requisitos

- Node.js 18+
- A API do backend rodando (ver [`../graosys-backend`](../graosys-backend))

## Configuração

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Copie o arquivo de exemplo de variáveis de ambiente e ajuste se necessário:

   ```bash
   cp .env.example .env
   ```

3. Rode em modo desenvolvimento:

   ```bash
   npm run dev
   ```

   A aplicação sobe em `http://localhost:5173` (padrão do Vite) e consome a API definida em
   `VITE_API_URL`.

### Variáveis de ambiente

| Variável | Descrição | Default |
|---|---|---|
| `VITE_API_URL` | URL base da API do backend | `http://localhost:3333` |
| `VITE_APP_NAME` | Nome exibido na aplicação | `GraoSys` |

## Scripts

| Comando | Descrição |
|---|---|
| `npm run dev` | Sobe o servidor de desenvolvimento do Vite |
| `npm run build` | Type-check (`tsc`) + build de produção |
| `npm run preview` | Serve localmente o build de produção |
| `npm run lint` | ESLint (falha em qualquer warning) |

## Estrutura

```
src/
  main.tsx                # Entry point (React + Router + AuthProvider)
  App.tsx                  # Composição raiz
  Routes.tsx               # Definição de rotas, PrivateRoute e AdminRoute
  contexts/
    AuthContext.tsx         # Login, sessão (JWT + dados do usuário em localStorage)
  services/
    api.ts                  # Instância do Axios, logout automático em 401
  components/
    layout/                  # Layout, sidebar, cabeçalho de página
    ui/                       # Componentes base (botão, input, tabela, dialog, etc.)
  pages/
    Login/
    Dashboard/
    Contracts/ (+ ContractForm)
    Clients/ (+ ClientForm)
    Execution/               # Acompanhamento/mudança de status dos contratos
    Billing/ (+ Receipt)
    Reports/
    MyAccount/
    Admin/                    # Users, AccessControl, Products, Tables — restrito a admin
```

## Autenticação e permissões

- O token JWT retornado pelo login é guardado em `localStorage` e enviado como
  `Authorization: Bearer <token>` em toda requisição (`AuthContext`/`services/api.ts`).
- `PrivateRoute` (em `Routes.tsx`) bloqueia acesso a quem não está autenticado.
- `AdminRoute` esconde as páginas em `/admin/*` de usuários com `role !== "admin"`.
- A tela `/admin/access` define, por usuário, permissões granulares
  (`view`/`create`/`edit`/`delete`) por módulo (`contracts`, `clients`, `execution`, `billing`,
  `reports`). **Essas permissões são enforced pelo backend** — o frontend não decide sozinho o
  que o usuário pode fazer; sempre trate a UI como uma conveniência, não como controle de acesso.

## Auditoria de segurança

Um relatório completo de auditoria de segurança (achados, correções aplicadas e issues
sugeridas) está em [`docs/security-audit/`](../docs/security-audit/), na raiz do monorepo.
