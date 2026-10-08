# Testes E2E (Playwright)

## Rodar no seu Mac

1. Backend rodando (`cd graosys-backend && npm run dev`) com um banco de **desenvolvimento**.
2. `cp .env.e2e.example .env.e2e` e preencha com um usuário **superadmin** desse banco.
3. `npm test` (sobe o Vite sozinho) · `npm run test:ui` (modo visual) · `npm run test:report` (último relatório).

Sem backend dá para rodar só `npm run test:public`.

## O que existe

| Arquivo | O que garante |
|---|---|
| `public/route-coverage.spec.ts` | Toda rota do `src/Routes.tsx` está registrada em `support/routes.ts`. Tela nova sem teste = CI vermelha. |
| `app/routes.spec.ts` | Todas as telas abrem logado, sem erro JS e sem 5xx da API. |
| `app/clients.spec.ts`, `app/platform.spec.ts` | Fluxos (cadastro/edição de cliente, detalhe de corretora). |
| `app/contracts.spec.ts` | Cliente + produto + broker → contrato → edição em `/contracts/:id`; campos obrigatórios. |
| `app/contract-template-data.spec.ts` | Dados dos templates de contrato: parte vinculada ao cadastro, conta de pagamento, fixações numeradas (F01…) com memória de cálculo (fator, fobbings, PPE) e endereço da corretora. |
| `app/contract-email.spec.ts` | Envio do contrato: grupos de e-mail de vendedor e comprador digitados na tela de envio, validação e gravação no contrato; e-mails do cadastro do cliente entram no contrato e são sugeridos no envio. |
| `app/contract-pdf.spec.ts` | PDF do contrato pela linha de Contratos e de Execução (via do vendedor/comprador em nova aba); a API só serve contratos da própria corretora. |
| `app/contract-workflow.spec.ts` | Fluxo por departamento: Contratos → Execução (devolver com motivo, aprovar) → envio; permissão pela etapa; cancelar/reabrir; fluxo simplificado; filas e histórico nas telas. Use `approvedContract()` para ter um contrato já na fila de envio. |
| `app/billing.spec.ts` | Recebimentos mudam o status de cobrança do contrato (A Faturar → A Receber → Parcial → Recebido; Em Atraso); cálculo do líquido. |
| `app/broker-commissions.spec.ts` | Tabela de % por data do broker, % do contrato, parte liberada pelo que a corretora recebeu, filtro de período e produtividade. |
| `app/permissions.spec.ts` | Usuário comum: menu, telas restritas redirecionam, API devolve 403; liberar módulo pelo Controle de Acesso. |
| `app/platform-tenant-delete.spec.ts` | Excluir corretora pelo Painel: só inativa/suspensa, confirmação pelo nome, apaga todos os dados e o login; a própria corretora não sai. |
| `app/leads.spec.ts` | Lead: criar, mover de etapa, editar ficha em `/platform/leads/:id`, remover. |
| `public/login.spec.ts` | Login, redirecionamento e recuperação de senha. |
| `public/password-reset.spec.ts` | `/reset-password` sem token, senhas diferentes, token inválido. |

`support/api.ts` monta dados pela API (token do superadmin salvo pelo setup) para o que não é o foco do spec.

Pendências aparecem como `fixme` no relatório (ver `pending` em `support/routes.ts`).

## CI

- `playwright.yml`: sobe Postgres + backend + frontend e roda tudo em cada PR/push.
- `tests-required.yml`: falha o PR que muda o app sem mudar `tests/` (exceção: label `sem-teste`).
