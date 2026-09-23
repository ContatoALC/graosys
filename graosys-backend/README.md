# GraoSys — Backend

API do GraoSys, um SaaS multi-tenant para corretoras de grãos: gestão de contratos, clientes,
recebimentos (cobrança), produtos/mesas e usuários por corretora (tenant).

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
