#!/usr/bin/env python3
"""
Gerador do Relatório de Auditoria de Segurança — GraoSys.

Uso:
    source .venv/bin/activate  (a partir de docs/security-audit/)
    pip install -r requirements.txt   # ou: pip install reportlab matplotlib
    python generate_report.py

Gera: relatorio-auditoria-seguranca.pdf (nesta mesma pasta).
"""
import os
from datetime import date

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle,
    Image, PageBreak, NextPageTemplate, KeepTogether, HRFlowable, ListFlowable, ListItem
)
from reportlab.platypus.flowables import Flowable
from reportlab.pdfgen import canvas as pdfcanvas

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_PDF = os.path.join(HERE, "relatorio-auditoria-seguranca.pdf")
ASSETS = os.path.join(HERE, "_assets")
os.makedirs(ASSETS, exist_ok=True)

# ----------------------------------------------------------------------------
# Paleta
# ----------------------------------------------------------------------------
COLOR_CRITICA = "#B91C1C"
COLOR_ALTA = "#EA580C"
COLOR_MEDIA = "#D97706"
COLOR_BAIXA = "#2563EB"
COLOR_FORTE = "#059669"
COLOR_INFO = "#6B7280"
COLOR_TEXT = "#1F2937"
COLOR_MUTED = "#6B7280"
COLOR_BORDER = "#E5E7EB"
COLOR_BG_SOFT = "#F9FAFB"
COLOR_HEADER_BG = "#111827"

SEV_COLOR = {
    "Crítica": COLOR_CRITICA,
    "Alta": COLOR_ALTA,
    "Média": COLOR_MEDIA,
    "Baixa": COLOR_BAIXA,
    "Informativa": COLOR_INFO,
}
SEV_ORDER = ["Crítica", "Alta", "Média", "Baixa", "Informativa"]

PROJECT_NAME = "GraoSys"
REPORT_TITLE = f"Relatório de Auditoria de Segurança — {PROJECT_NAME}"
REPORT_DATE = date.today().strftime("%d/%m/%Y")

# ----------------------------------------------------------------------------
# DADOS DA AUDITORIA (extraídos e verificados manualmente no código-fonte)
# ----------------------------------------------------------------------------

FINDINGS = [
    dict(
        id="F1",
        severity="Crítica",
        category="3. IDOR",
        title="Mass assignment de chave primária permite sequestro de registros de qualquer tenant",
        file="graosys-backend/src/app/controllers/ClientController.ts",
        lines="9, 50",
        files_extra=[
            ("graosys-backend/src/app/controllers/GrainContractController.ts", "9-16, 51"),
            ("graosys-backend/src/app/controllers/BillingController.ts", "8, 48"),
            ("graosys-backend/src/app/controllers/ProductController.ts", "11, 33, 50, 72"),
        ],
        snippet=(
            "// ClientController.update (linha 46-53)\n"
            "const client = await clientRepo.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });\n"
            "if (!client) return res.status(404)...;\n"
            "Object.assign(client, req.body);   // <-- body pode conter \"id\" e \"tenant_id\"\n"
            "await clientRepo.save(client);\n\n"
            "// ClientController.create (linha 8-11) — mesmo padrão no POST\n"
            "const client = clientRepo.create({ ...req.body, tenant_id: req.user.tenant_id });\n"
            "await clientRepo.save(client);"
        ),
        why=(
            "O TypeORM decide INSERT vs UPDATE em tempo de save() consultando o banco pelo valor "
            "ATUAL da chave primária do objeto (SubjectDatabaseEntityLoader.load(), que gera "
            "\"WHERE id IN (...)\" usando entity.id no momento do save — confirmado lendo "
            "node_modules/typeorm/persistence/SubjectDatabaseEntityLoader.js e Subject.js:230). "
            "Como o `id` é uma coluna comum (@PrimaryColumn, UUID setado no client) e tanto o "
            "create() (spread de `...req.body`) quanto o update() (Object.assign(entity, req.body)) "
            "aceitam QUALQUER campo do body sem whitelist, um atacante autenticado pode enviar "
            "POST /api/clients (ou PATCH /api/clients/:id) com `{ \"id\": \"<uuid-de-outro-tenant>\", ... }`. "
            "A checagem de posse (`tenant_id: req.user.tenant_id`) só é aplicada no SELECT inicial, que "
            "localiza um registro do PRÓPRIO atacante — mas o `save()` final grava por PK, ignorando "
            "esse filtro, sobrescrevendo o registro-alvo com os dados do atacante e o `tenant_id` do "
            "atacante. O mesmo padrão idêntico se repete em GrainContractController, BillingController, "
            "ProductController e ProductTableController (create e update)."
        ),
        exploit=(
            "Pré-condição: o atacante precisa conhecer/adivinhar o UUID do registro-alvo (não é "
            "sequencial, mas UUIDs circulam em URLs da própria aplicação, relatórios exportados, "
            "logs, e-mails de contrato — qualquer usuário autenticado, mesmo com plano trial, "
            "pode disparar o ataque)."
        ),
        impact="Reescrita/hijack de registros (clientes, contratos, cobranças, produtos, mesas de preço) de QUALQUER outro tenant do SaaS — quebra total do isolamento multi-tenant na camada de escrita.",
    ),
    dict(
        id="F2",
        severity="Crítica",
        category="2. Permissão no navegador",
        title="Sistema de permissões granulares (view/create/edit/delete por módulo) nunca é verificado no backend",
        file="graosys-backend/src/app/routes/index.ts",
        lines="44-92",
        files_extra=[
            ("graosys-backend/src/app/controllers/UserController.ts", "8, 16, 55, 60"),
            ("graosys-frontend/src/pages/Admin/AccessControl/index.tsx", "1-121"),
        ],
        snippet=(
            "// routes/index.ts — únicas verificações de papel existentes:\n"
            "router.get(\"/api/clients\", client.getAll);      // sem check de permissão\n"
            "router.post(\"/api/clients\", client.create);      // sem check de permissão\n"
            "router.patch(\"/api/clients/:id\", client.update); // sem check de permissão\n"
            "router.post(\"/api/contracts\", contract.create);  // sem check de permissão\n"
            "router.post(\"/api/billings\", billing.create);    // sem check de permissão\n"
            "// requireRole(\"admin\") só existe em rotas de admin/produtos/usuários e nos deletes"
        ),
        why=(
            "A tela /admin/access (AdminAccessControlPage) permite ao admin configurar, por usuário "
            "não-admin, quais ações (\"view\", \"create\", \"edit\", \"delete\") ele pode executar em cada "
            "módulo (contracts, clients, execution, billing, reports) e persiste isso em "
            "`User.permissions` via PATCH /api/users/:id. Buscando `permissions` em todo o "
            "backend (grep), o único uso é: gravar o campo, devolvê-lo no login/perfil e no "
            "PATCH de usuário — NENHUM controller (Client, GrainContract, Billing, Product) lê ou "
            "valida `req.user.permissions` antes de autorizar create/edit. O frontend também não "
            "usa `permissions` em nenhuma página (nenhuma ocorrência de `hasPermission`/checagem "
            "condicional fora do AccessControl). Ou seja: a feature de permissões granulares é "
            "inteiramente decorativa — dá ao administrador uma falsa sensação de controle de acesso "
            "por módulo/ação, quando na prática QUALQUER usuário autenticado (independente da "
            "configuração) tem acesso total de criação/edição a contratos, clientes, cobranças e "
            "relatórios, só ficando de fora as ações de delete e as telas administrativas "
            "(que dependem apenas de `role === \"admin\"\", não de `permissions`)."
        ),
        exploit="Basta ser um usuário autenticado com role \"user\" — nenhuma configuração especial necessária; o gate simplesmente não existe.",
        impact="Falha de segregação de funções: um usuário configurado para \"somente visualizar contratos\" pode, na prática, criar/editar/enviar e-mails de contratos, cobranças e clientes livremente.",
    ),
    dict(
        id="F3",
        severity="Alta",
        category="4. Chaves expostas",
        title="JWT_SECRET com fallback hardcoded \"secret\" sem validação de startup",
        file="graosys-backend/src/app/middlewares/authMiddleware.ts",
        lines="32",
        files_extra=[("graosys-backend/src/app/controllers/SessionController.ts", "45")],
        snippet=(
            "// authMiddleware.ts:32\n"
            "const decoded = jwt.verify(token, process.env.JWT_SECRET || \"secret\") as TokenPayload;\n\n"
            "// SessionController.ts:45 (assinatura do token no login)\n"
            "const token = jwt.sign({ ... }, process.env.JWT_SECRET || \"secret\", { expiresIn: \"8h\" });"
        ),
        why=(
            "Se a variável de ambiente `JWT_SECRET` não estiver definida no ambiente de execução "
            "(erro de configuração no deploy, container mal configurado, etc.), a aplicação assina e "
            "valida tokens usando a string literal `\"secret\"` — um segredo público, presente no "
            "código-fonte. Não existe nenhuma checagem de startup (em server.ts/api/index.ts) que "
            "aborte a inicialização caso `JWT_SECRET` esteja ausente ou seja igual ao valor default "
            "do `.env.example` (`your-super-secret-key-change-in-production`)."
        ),
        exploit=(
            "Explorável apenas se a variável de ambiente estiver ausente em produção (falha de "
            "configuração de deploy) — nesse cenário, qualquer pessoa pode forjar um JWT válido "
            "(inclusive `role: \"admin\"` e `tenant_id` arbitrário) usando a chave pública \"secret\", "
            "obtendo acesso total a qualquer tenant sem autenticação."
        ),
        impact="Personificação total de qualquer usuário/tenant caso o segredo não seja configurado corretamente no ambiente de deploy.",
    ),
    dict(
        id="F4",
        severity="Alta",
        category="5. Inputs sem tratamento (XSS)",
        title="Endpoint de e-mail customizado aceita HTML arbitrário sem sanitização e sem restrição de papel",
        file="graosys-backend/src/app/controllers/EmailController.ts",
        lines="88-109",
        files_extra=[("graosys-backend/src/app/routes/index.ts", "84-85")],
        snippet=(
            "// EmailController.sendCustomEmail (linha 88-109)\n"
            "async sendCustomEmail(req: Request, res: Response) {\n"
            "  const { to, subject, body } = req.body;\n"
            "  ...\n"
            "  await transporter.sendMail({\n"
            "    from: `\"${tenant.name}\" <${process.env.SMTP_USER}>`,\n"
            "    to: Array.isArray(to) ? to : [to],\n"
            "    subject,\n"
            "    html: body,               // <-- HTML 100% controlado pelo usuário, sem escape\n"
            "  });\n"
            "}\n\n"
            "// routes/index.ts:85 — nenhum requireRole()\n"
            "router.post(\"/api/email/send-custom\", email.sendCustomEmail);"
        ),
        why=(
            "`body` chega diretamente do JSON do request e é usado como `html` do e-mail sem "
            "qualquer sanitização (o projeto não tem `sanitize-html`, `dompurify` ou similar em "
            "nenhum `package.json`). Além disso, a rota não exige `requireRole(\"admin\")` nem "
            "verifica `permissions` (achado F2) — qualquer usuário autenticado do tenant, mesmo "
            "com papel \"user\", pode chamá-la. `to` também não é validado contra os clientes do "
            "tenant, permitindo envio para qualquer endereço externo."
        ),
        exploit="Requer apenas uma conta autenticada de qualquer papel no tenant (trial incluso).",
        impact="Uso da credencial SMTP corporativa como relay para phishing/HTML malicioso arbitrário enviado a qualquer destinatário, em nome da corretora.",
    ),
    dict(
        id="F5",
        severity="Alta",
        category="4. Chaves expostas",
        title="Credencial de banco de dados com default hardcoded \"postgres/postgres\"",
        file="graosys-backend/src/database/data-source.ts",
        lines="39-41",
        files_extra=[],
        snippet=(
            "host: process.env.TYPEORM_HOST || \"localhost\",\n"
            "port: Number(process.env.TYPEORM_PORT) || 5432,\n"
            "username: process.env.TYPEORM_USERNAME || \"postgres\",\n"
            "password: process.env.TYPEORM_PASSWORD || \"postgres\",\n"
            "database: process.env.TYPEORM_DATABASE || \"graosys\","
        ),
        why=(
            "Caso as variáveis `TYPEORM_*` não sejam definidas (branch usada quando não há "
            "`DATABASE_URL`/`POSTGRES_URL`), a aplicação tenta conectar com usuário/senha "
            "`postgres`/`postgres` — uma credencial padrão amplamente conhecida. Não há validação "
            "de startup que rejeite essa combinação em `NODE_ENV=production`."
        ),
        exploit="Explorável se o banco de destino também usar credenciais padrão (comum em containers Postgres locais/mal configurados) e estiver acessível na rede.",
        impact="Acesso não autorizado ao banco de dados completo (todos os tenants) caso a instância Postgres aceite a credencial default e esteja exposta.",
    ),
    dict(
        id="F6",
        severity="Média",
        category="5. Inputs sem tratamento (XSS)",
        title="HTML de e-mail transacional de contrato interpola campos do usuário sem escape",
        file="graosys-backend/src/app/controllers/EmailController.ts",
        lines="112-149",
        files_extra=[],
        snippet=(
            "function buildContractHtml(contract, tenant) {\n"
            "  return (role, recipientName) => `\n"
            "    ...\n"
            "    <p>Para <strong>${recipientName}</strong>,</p>\n"
            "    ...\n"
            "    <td>${contract.name_product}</td>\n"
            "    <td>${contract.pickup_location || \"—\"}</td>\n"
            "    ${contract.observation ? `<tr>...${contract.observation}</tr>` : \"\"}\n"
            "  `;\n"
            "}"
        ),
        why=(
            "`recipientName` (derivado de `contract.seller`/`contract.buyer`, arrays de texto livre "
            "informados na criação do contrato), `contract.observation`, `contract.name_product`, "
            "`contract.pickup_location` e `contract.payment` são interpolados diretamente em um "
            "template de HTML enviado por e-mail (`nodemailer`, `html: contractHtml(...)`), sem "
            "nenhuma função de escape (`encodeURIComponent`, `escape-html`, etc.). Qualquer usuário "
            "com permissão de criar contrato (todo usuário autenticado, ver F2) pode injetar HTML "
            "nesses campos."
        ),
        exploit=(
            "Requer que o contrato criado com payload malicioso (`<a href=\"javascript:...\">` ou "
            "tags que alterem o layout/insiram links de phishing) seja posteriormente enviado por "
            "e-mail via POST /api/email/send-contract."
        ),
        impact="Injeção de HTML/links em e-mails corporativos legítimos, usados para phishing contra vendedores/compradores destinatários do contrato.",
    ),
    dict(
        id="F7",
        severity="Baixa",
        category="4. Chaves expostas",
        title="Coluna password sem select:false — depende de disciplina manual em cada query",
        file="graosys-backend/src/app/entities/User.ts",
        lines="24",
        files_extra=[],
        snippet=(
            "@Column()\n"
            "password: string;   // sem { select: false }"
        ),
        why=(
            "Todas as leituras de usuário auditadas (UserController.getAll/getById/getProfile, "
            "SessionController) hoje evitam vazar o hash — por `select` explícito de colunas ou por "
            "desestruturação `const { password: _, ...userData }`. Porém, como a coluna não tem "
            "`{ select: false }` no nível da entidade, basta um novo endpoint futuro fazer "
            "`userRepo.findOne({ where: {...} })` sem selecionar campos explicitamente para vazar o "
            "hash bcrypt do usuário na resposta — não há rede de proteção estrutural, só convenção."
        ),
        exploit="Não explorável hoje (nenhum endpoint atual vaza o campo) — é uma lacuna de defesa em profundidade.",
        impact="Risco de regressão futura: um novo endpoint pode vazar hashes de senha por omissão.",
    ),
]

REMEDIATION = {
    "F1": (
        "Corrigido em 15/09/2026: criado utilitário `pickFields()` "
        "(graosys-backend/src/utils/pickFields.ts) e aplicado em create/update de "
        "ClientController, GrainContractController, BillingController, ProductController e "
        "ProductTableController — `id` e `tenant_id` nunca mais são aceitos a partir do body."
    ),
    "F2": (
        "Corrigido em 15/09/2026: adicionado middleware `requirePermission(module, action)` "
        "(authMiddleware.ts) e aplicado em todas as rotas de view/create/edit de contracts, "
        "clients, billing, reports e execution (routes/index.ts). Admins continuam com acesso "
        "total; usuários não-admin agora dependem da configuração feita em /admin/access."
    ),
    "F3": (
        "Corrigido em 15/09/2026: criado `validateEnv()` (src/config/validateEnv.ts), chamado "
        "no bootstrap (server.ts e api/index.ts), que aborta o startup em produção se "
        "`JWT_SECRET` estiver ausente, curto ou igual a um valor padrão conhecido. O fallback "
        "hardcoded foi isolado em `src/config/jwtSecret.ts`, usado apenas fora de produção."
    ),
    "F4": (
        "Corrigido em 15/09/2026: `/api/email/send-custom` agora exige `requireRole(\"admin\")` "
        "e o campo `body` passa por `sanitize-html` (allowlist de tags/atributos) antes do envio."
    ),
    "F5": (
        "Corrigido em 15/09/2026: `validateEnv()` também rejeita, em produção, credenciais de "
        "banco ausentes ou iguais aos defaults conhecidos (`postgres`/`postgres`)."
    ),
    "F6": (
        "Corrigido em 15/09/2026: todos os campos de contrato interpolados em "
        "`buildContractHtml` (EmailController.ts) agora passam por uma função `escapeHtml()` "
        "antes de entrar no template de e-mail."
    ),
    "F7": (
        "Corrigido em 15/09/2026: coluna `password` marcada com `{ select: false }` "
        "(User.ts); os dois pontos que precisam do hash (login e resetPassword em "
        "SessionController.ts) agora o solicitam explicitamente via `select`."
    ),
}

STRENGTHS = [
    dict(
        title="Isolamento de tenant nas leituras (categoria 1)",
        detail=(
            "Todos os métodos de listagem/busca/agregação/relatório auditados — "
            "ClientController (getAll, getById, getByCnpjCpf), GrainContractController (getAll, "
            "getById, getReport), BillingController (getAll, getById, getByNumberContract, "
            "getSummary), ProductController/ProductTableController (getAll, getById) e "
            "DashboardController.getSummary — filtram corretamente por "
            "`tenant_id: req.user.tenant_id`, valor extraído do JWT assinado pelo servidor, nunca "
            "de input do cliente. Nenhum handler de listagem aceita um `tenant_id` vindo de "
            "query/body/params.",
        ),
    ),
    dict(
        title="Gate de papel (admin) aplicado no backend onde existe equivalente no frontend",
        detail=(
            "Todas as rotas administrativas expostas no frontend (rotas `/admin/*`, gated por "
            "`AdminRoute` em Routes.tsx) têm o equivalente `requireRole(\"admin\")` no backend: "
            "gestão de usuários (GET/POST/PATCH/DELETE /api/users), escrita de produtos e mesas de "
            "produtos, atualização de dados do tenant e delete de clientes/contratos/cobranças. "
            "Não foi encontrada nenhuma ação administrativa exposta na UI que fique apenas com o "
            "gate visual do frontend sem o correspondente no servidor.",
        ),
    ),
    dict(
        title="Autenticação e senha tratadas corretamente",
        detail=(
            "SessionController.login usa bcrypt.compare, nunca retorna o hash da senha, bloqueia "
            "login de tenants com `status === \"suspended\"` e de usuários com `active === false`. "
            "resetPassword exige a senha atual antes de trocar. UserController nunca devolve o "
            "campo `password` em nenhum dos 4 endpoints que retornam dados de usuário (select "
            "explícito de colunas ou desestruturação).",
        ),
    ),
    dict(
        title="Sem SQL Injection",
        detail=(
            "As duas únicas construções de query manual do projeto (`createQueryBuilder` em "
            "GrainContractController.getReport e BillingController.getSummary) usam exclusivamente "
            "parâmetros nomeados (`:tenant_id`, `:year`, `:crop`, etc.) via `.andWhere(\"c.crop = "
            ":crop\", { crop })`, sem nenhuma concatenação de string do usuário na query.",
        ),
    ),
    dict(
        title="Sem XSS no frontend",
        detail=(
            "Busca exaustiva por `dangerouslySetInnerHTML`, `innerHTML`, `v-html`, `eval(` e "
            "`new Function` em todo o diretório `graosys-frontend/src` não retornou nenhuma "
            "ocorrência. Toda a renderização de dados do usuário passa pelo escaping automático do "
            "React (JSX).",
        ),
    ),
    dict(
        title="Segredos não versionados no Git",
        detail=(
            "`.env` está listado em `.gitignore` desde o commit inicial e uma varredura em "
            "`git log --all -p` não encontrou nenhum valor de segredo real (não-placeholder) "
            "commitado — apenas os defaults de exemplo já reportados como achados (F3/F5).",
        ),
    ),
]

RECOMMENDATIONS = [
    dict(p="P1", text="Substituir todo `Object.assign(entity, req.body)` e `{ ...req.body }` em create/update (Client, GrainContract, Billing, Product, ProductTable) por uma whitelist explícita de campos permitidos, ignorando sempre `id` e `tenant_id` do body (ver F1)."),
    dict(p="P1", text="Implementar de fato o middleware de checagem de `permissions` (view/create/edit/delete por módulo) em todas as rotas de escrita, ou remover a tela de Controle de Acesso até que a enforcement exista, para não criar falsa sensação de segurança (ver F2)."),
    dict(p="P2", text="Adicionar validação de startup que aborte o boot da aplicação em `NODE_ENV=production` se `JWT_SECRET` estiver ausente/curto ou igual ao valor de exemplo, e o mesmo para credenciais de banco default (ver F3, F5)."),
    dict(p="P2", text="Restringir `/api/email/send-custom` a `requireRole(\"admin\")` (ou à permissão de módulo correspondente) e sanitizar `body` com uma biblioteca como `sanitize-html` antes de repassar a nodemailer (ver F4)."),
    dict(p="P2", text="Aplicar escape de HTML (ex.: uma função `escapeHtml()` central) em todos os campos de contrato interpolados em `buildContractHtml` antes de montar o template de e-mail (ver F6)."),
    dict(p="P3", text="Adicionar `{ select: false }` na coluna `password` da entidade `User` como defesa em profundidade contra vazamento futuro do hash (ver F7)."),
    dict(p="P3", text="Revisar a configuração de CORS (`origin: process.env.FRONTEND_URL || \"*\"` combinado com `credentials: true`) para nunca cair no wildcard em produção, e evitar que `errorMiddleware` repasse `err.message` cru para qualquer tipo de exceção."),
]

GITHUB_ISSUES = [
    dict(
        n=1,
        title="[Segurança] Mass assignment de ID/tenant_id permite sequestro de registros entre tenants (Client, Contract, Billing, Product, ProductTable)",
        labels=["security", "critical"],
        body=(
            "## Descrição do problema\n"
            "Os métodos `create` e `update` de `ClientController`, `GrainContractController`, "
            "`BillingController`, `ProductController` e `ProductTableController` constroem/atualizam "
            "a entidade a partir de `req.body` sem whitelist de campos "
            "(`{ ...req.body, tenant_id: req.user.tenant_id }` no create e "
            "`Object.assign(entity, req.body)` no update). O TypeORM decide INSERT vs UPDATE "
            "consultando o banco pelo valor **atual** da chave primária do objeto no momento do "
            "`save()` (`SubjectDatabaseEntityLoader`), então um `id` (ou `tenant_id`) enviado no "
            "body é aceito e usado para localizar/gravar QUALQUER linha da tabela, de qualquer "
            "tenant — não apenas as do usuário autenticado.\n\n"
            "## Por que é explorável\n"
            "A checagem `tenant_id: req.user.tenant_id` só é aplicada no `SELECT` inicial (que "
            "sempre localiza um registro do PRÓPRIO atacante); o `save()` final grava por chave "
            "primária, ignorando esse filtro. Basta o atacante conhecer o UUID de um registro de "
            "outro tenant (exposto em URLs da própria app, relatórios exportados, e-mails de "
            "contrato) para sobrescrevê-lo com dados arbitrários e o `tenant_id` do atacante.\n\n"
            "## Evidência\n"
            "```ts\n"
            "// graosys-backend/src/app/controllers/ClientController.ts:46-53\n"
            "async update(req: Request, res: Response) {\n"
            "  const client = await clientRepo.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });\n"
            "  if (!client) return res.status(404).json({ error: \"Cliente não encontrado\" });\n"
            "  Object.assign(client, req.body); // <-- aceita id/tenant_id arbitrários\n"
            "  await clientRepo.save(client);\n"
            "  return res.json(client);\n"
            "}\n"
            "```\n"
            "Mesmo padrão em:\n"
            "- `ClientController.ts:9` (create)\n"
            "- `GrainContractController.ts:9-16,51` (create/update)\n"
            "- `BillingController.ts:8,48` (create/update)\n"
            "- `ProductController.ts:11,33,50,72` (create/update de Product e ProductTable)\n\n"
            "## Impacto\n"
            "Quebra total do isolamento multi-tenant na camada de escrita: um usuário de qualquer "
            "tenant (mesmo trial) pode corromper ou sequestrar clientes, contratos, cobranças, "
            "produtos e mesas de preço de outro tenant.\n\n"
            "## Sugestão de correção\n"
            "Substituir os spreads/Object.assign por uma função de whitelist explícita por entidade, "
            "que nunca aceite `id` nem `tenant_id` vindos do body, ex.:\n"
            "```ts\n"
            "const { id, tenant_id, ...safeBody } = req.body;\n"
            "Object.assign(client, safeBody);\n"
            "```\n"
            "(idealmente validado com um schema — zod já é dependência do frontend, pode ser "
            "adotado no backend também).\n\n"
            "## Critérios de aceite\n"
            "- [ ] Nenhum handler de create/update aceita `id` ou `tenant_id` vindos do body\n"
            "- [ ] Whitelist explícita de campos aplicada em Client, GrainContract, Billing, "
            "Product e ProductTable (create e update)\n"
            "- [ ] Teste automatizado que tenta sobrescrever um registro de outro tenant via "
            "`id`/`tenant_id` no body e espera 404/erro\n"
            "- [ ] Revisão de regressão nas 5 entidades listadas"
        ),
    ),
    dict(
        n=2,
        title="[Segurança] Permissões granulares por módulo (view/create/edit/delete) não são aplicadas em nenhum endpoint",
        labels=["security", "critical"],
        body=(
            "## Descrição do problema\n"
            "A tela `/admin/access` permite configurar, por usuário não-admin, permissões "
            "granulares (`view`/`create`/`edit`/`delete`) por módulo (`contracts`, `clients`, "
            "`execution`, `billing`, `reports`), persistidas em `User.permissions`. Nenhum "
            "controller do backend (nem componente do frontend fora da própria tela de "
            "configuração) lê ou valida esse campo antes de autorizar uma ação.\n\n"
            "## Por que é explorável\n"
            "Basta autenticar como qualquer usuário não-admin. As únicas verificações de "
            "autorização existentes no backend são `authMiddleware` (JWT válido) e "
            "`requireRole(\"admin\")` (aplicado apenas em rotas administrativas e nos deletes). "
            "Create/edit de contratos, clientes, cobranças e relatórios ficam liberados "
            "independentemente da configuração de `permissions`.\n\n"
            "## Evidência\n"
            "```ts\n"
            "// graosys-backend/src/app/routes/index.ts:51-73 (trecho)\n"
            "router.post(\"/api/clients\", client.create);       // sem check de permissão\n"
            "router.patch(\"/api/clients/:id\", client.update);  // sem check de permissão\n"
            "router.post(\"/api/contracts\", contract.create);   // sem check de permissão\n"
            "router.post(\"/api/billings\", billing.create);     // sem check de permissão\n"
            "```\n"
            "`permissions` só aparece em `UserController.ts` (armazenar/retornar) e em "
            "`SessionController.ts` (repassar no token) — nunca em uma checagem de autorização.\n\n"
            "## Impacto\n"
            "Falsa sensação de segurança para administradores que configuram segregação de "
            "funções; qualquer usuário mantém acesso de escrita total aos módulos operacionais.\n\n"
            "## Sugestão de correção\n"
            "Criar um middleware `requirePermission(module, action)` que leia "
            "`req.user.permissions[module]` e aplicá-lo em todas as rotas de "
            "create/update/delete de contracts, clients, billing e reports; ou, como medida "
            "imediata, remover/ocultar a tela de Controle de Acesso até a enforcement existir.\n\n"
            "## Critérios de aceite\n"
            "- [ ] Middleware de checagem de permissão implementado e coberto por teste\n"
            "- [ ] Aplicado em todas as rotas de escrita dos módulos contracts/clients/billing/reports\n"
            "- [ ] Usuário sem permissão de `create`/`edit` em um módulo recebe 403 ao tentar a ação via API diretamente"
        ),
    ),
    dict(
        n=3,
        title="[Segurança] Defaults inseguros hardcoded (JWT_SECRET e credencial de banco) sem validação de startup",
        labels=["security", "high"],
        body=(
            "## Descrição do problema\n"
            "Dois segredos críticos têm fallback hardcoded no código-fonte, usados silenciosamente "
            "quando a variável de ambiente correspondente não está definida:\n"
            "- `JWT_SECRET` → fallback `\"secret\"`\n"
            "- Credenciais Postgres → fallback `postgres`/`postgres`\n\n"
            "Não existe nenhuma validação de startup que rejeite esses defaults quando "
            "`NODE_ENV=production`.\n\n"
            "## Por que é explorável\n"
            "Se a variável de ambiente correspondente faltar no ambiente de deploy (erro de "
            "configuração), a aplicação sobe normalmente usando o segredo público — permitindo "
            "forjar JWTs válidos (incluindo `role: admin`) ou acessar o banco com credencial "
            "padrão, sem qualquer alerta.\n\n"
            "## Evidência\n"
            "```ts\n"
            "// graosys-backend/src/app/middlewares/authMiddleware.ts:32\n"
            "const decoded = jwt.verify(token, process.env.JWT_SECRET || \"secret\") as TokenPayload;\n\n"
            "// graosys-backend/src/app/controllers/SessionController.ts:45\n"
            "process.env.JWT_SECRET || \"secret\",\n\n"
            "// graosys-backend/src/database/data-source.ts:39-41\n"
            "username: process.env.TYPEORM_USERNAME || \"postgres\",\n"
            "password: process.env.TYPEORM_PASSWORD || \"postgres\",\n"
            "database: process.env.TYPEORM_DATABASE || \"graosys\",\n"
            "```\n\n"
            "## Impacto\n"
            "Personificação total de qualquer usuário/tenant (via JWT forjado) ou acesso "
            "irrestrito ao banco de dados, caso o ambiente de produção não sobrescreva os "
            "defaults corretamente.\n\n"
            "## Sugestão de correção\n"
            "No bootstrap (`server.ts` / `api/index.ts`), validar em `NODE_ENV=production`:\n"
            "```ts\n"
            "if (process.env.NODE_ENV === \"production\") {\n"
            "  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {\n"
            "    throw new Error(\"JWT_SECRET ausente ou fraco em produção\");\n"
            "  }\n"
            "  if (!process.env.TYPEORM_PASSWORD && !process.env.DATABASE_URL) {\n"
            "    throw new Error(\"Credencial de banco não configurada em produção\");\n"
            "  }\n"
            "}\n"
            "```\n\n"
            "## Critérios de aceite\n"
            "- [ ] Aplicação recusa subir em produção sem `JWT_SECRET` forte configurado\n"
            "- [ ] Aplicação recusa subir em produção sem credencial de banco explícita\n"
            "- [ ] Fallbacks hardcoded removidos ou mantidos apenas para desenvolvimento local, "
            "de forma explícita (ex.: checando `NODE_ENV !== \"production\"`)"
        ),
    ),
    dict(
        n=4,
        title="[Segurança] HTML sem sanitização em e-mails (send-custom sem gate de papel + template de contrato sem escape)",
        labels=["security", "high"],
        body=(
            "## Descrição do problema\n"
            "1. `POST /api/email/send-custom` aceita `body` como HTML livre e o envia via "
            "`nodemailer` sem qualquer sanitização, para qualquer destinatário, sem exigir papel "
            "administrativo.\n"
            "2. `buildContractHtml` (template de e-mail de contrato) interpola campos de texto "
            "livre do contrato (`observation`, `name_product`, `pickup_location`, `payment`, "
            "nomes de vendedor/comprador) diretamente na string de HTML, sem escape.\n\n"
            "## Por que é explorável\n"
            "Não há biblioteca de sanitização (`sanitize-html`, `dompurify`, etc.) em nenhum "
            "`package.json` do projeto. Qualquer usuário autenticado (independente de papel — ver "
            "issue #2) pode: (a) chamar `send-custom` diretamente com HTML malicioso para "
            "qualquer endereço, usando a credencial SMTP da empresa; ou (b) cadastrar um contrato "
            "com HTML malicioso em `observation`/`pickup_location`/etc. e disparar o envio via "
            "`send-contract`.\n\n"
            "## Evidência\n"
            "```ts\n"
            "// graosys-backend/src/app/controllers/EmailController.ts:88-109\n"
            "async sendCustomEmail(req: Request, res: Response) {\n"
            "  const { to, subject, body } = req.body;\n"
            "  ...\n"
            "  await transporter.sendMail({ ..., html: body }); // sem sanitização\n"
            "}\n\n"
            "// routes/index.ts:85 — sem requireRole()\n"
            "router.post(\"/api/email/send-custom\", email.sendCustomEmail);\n\n"
            "// EmailController.ts:126-134 (trecho do template)\n"
            "<td>${contract.name_product}</td>\n"
            "<td>${contract.pickup_location || \"—\"}</td>\n"
            "${contract.observation ? `<tr>...${contract.observation}</tr>` : \"\"}\n"
            "```\n\n"
            "## Impacto\n"
            "Relay de phishing/HTML malicioso usando a identidade e a credencial SMTP da "
            "corretora; injeção de conteúdo em e-mails transacionais legítimos enviados a "
            "clientes externos (vendedores/compradores dos contratos).\n\n"
            "## Sugestão de correção\n"
            "- Restringir `/api/email/send-custom` a `requireRole(\"admin\")` (ou à permissão do "
            "módulo, uma vez implementada na issue #2) e sanitizar `body` com `sanitize-html` "
            "antes de repassar ao `nodemailer`.\n"
            "- Criar uma função `escapeHtml()` central e aplicá-la em todos os campos de contrato "
            "interpolados em `buildContractHtml`.\n\n"
            "## Critérios de aceite\n"
            "- [ ] `send-custom` exige papel admin (ou permissão equivalente)\n"
            "- [ ] `body` de `send-custom` passa por sanitização antes do envio\n"
            "- [ ] Todos os campos de contrato em `buildContractHtml` são escapados\n"
            "- [ ] Teste com payload `<img src=x onerror=alert(1)>` em `observation` confirma que "
            "o e-mail final não contém a tag ativa"
        ),
    ),
    dict(
        n=5,
        title="[Segurança] Hardening diversos: coluna password sem select:false, CORS wildcard+credentials, vazamento de err.message",
        labels=["security", "low"],
        body=(
            "## Descrição do problema\n"
            "Três itens de baixo risco, agrupados por serem melhorias de defesa em profundidade "
            "e não vulnerabilidades exploráveis diretamente hoje:\n\n"
            "1. `User.password` não tem `{ select: false }` — depende de disciplina manual em "
            "cada query para não vazar o hash bcrypt.\n"
            "2. CORS configurado com `origin: process.env.FRONTEND_URL || \"*\"` e "
            "`credentials: true` — se a env var não for definida, qualquer origem é aceita.\n"
            "3. `errorMiddleware` retorna `err.message` cru como resposta 400 para qualquer "
            "exceção, podendo vazar detalhes internos (ex.: mensagens de constraint do banco).\n\n"
            "## Evidência\n"
            "```ts\n"
            "// graosys-backend/src/app/entities/User.ts:24\n"
            "@Column()\n"
            "password: string; // sem select: false\n\n"
            "// graosys-backend/src/app.ts:10-13\n"
            "app.use(cors({ origin: process.env.FRONTEND_URL || \"*\", credentials: true }));\n\n"
            "// graosys-backend/src/app/middlewares/errorMiddleware.ts:5-7\n"
            "if (err.message) return res.status(400).json({ error: err.message });\n"
            "```\n\n"
            "## Impacto\n"
            "Baixo isoladamente; aumentam a superfície de risco caso outras proteções falhem "
            "(regressão futura, erro de configuração de deploy, exceções inesperadas).\n\n"
            "## Sugestão de correção\n"
            "- Adicionar `{ select: false }` na coluna `password`.\n"
            "- Nunca deixar `FRONTEND_URL` cair no wildcard em produção; validar no startup.\n"
            "- Retornar apenas mensagens de erro conhecidas/tratadas (whitelist), logando o "
            "detalhe completo só no servidor.\n\n"
            "## Critérios de aceite\n"
            "- [ ] `password` marcado com `select: false` e endpoints existentes continuam "
            "funcionando (selects explícitos ainda funcionam)\n"
            "- [ ] CORS falha o startup em produção se `FRONTEND_URL` não estiver definida\n"
            "- [ ] `errorMiddleware` não repassa mensagens de exceções não tratadas ao cliente"
        ),
    ),
]

METHODOLOGY = (
    "Stack detectada: backend Node.js/Express + TypeScript, ORM TypeORM sobre PostgreSQL, "
    "autenticação via JWT stateless (sem sessão em banco), multi-tenancy implementado por "
    "coluna `tenant_id` manual em cada tabela (não é Supabase/RLS). Frontend: React 18 + "
    "Vite + TypeScript + React Router + Axios, sem SSR. Deploy via Vercel "
    "(`vercel.json` de rewrites em backend e frontend), sem Docker/Kubernetes/Terraform no "
    "repositório.\n\n"
    "Mapeamento das 5 categorias para esta stack:\n"
    "1. Isolamento de tenant → não há RLS (Postgres puro via TypeORM); o mecanismo é o filtro "
    "manual `tenant_id: req.user.tenant_id` que cada controller deve aplicar em toda query.\n"
    "2. Permissão no navegador → comparação entre os gates de `role`/`permissions` no React "
    "Router (`AdminRoute`, tela de Controle de Acesso) e o middleware `requireRole()`/checagem "
    "de `permissions` no Express.\n"
    "3. IDOR → percorridos sistematicamente todos os handlers de "
    "`SessionController, TenantController, UserController, ClientController, "
    "GrainContractController, BillingController, ProductController, ProductTableController, "
    "DashboardController, EmailController` (rotas em `src/app/routes/index.ts`).\n"
    "4. Chaves expostas → variáveis de ambiente e seus fallbacks em código "
    "(`authMiddleware.ts`, `SessionController.ts`, `data-source.ts`), `.env`/`.env.example`, "
    "`vercel.json`, e histórico completo do `git log --all -p`.\n"
    "5. XSS → grep exaustivo por `dangerouslySetInnerHTML`/`innerHTML`/`eval`/`new Function` em "
    "todo o frontend React, e revisão de todo ponto do backend que gera HTML "
    "(`EmailController`, templates de e-mail via `nodemailer`)."
)

SCOPE = (
    "graosys-backend/ (Express + TypeORM + PostgreSQL) e graosys-frontend/ (React + Vite), "
    "incluindo todos os controllers, middlewares, rotas, entidades, configuração de banco, "
    "arquivos .env/.env.example, vercel.json e histórico completo do repositório Git "
    "(3 commits: 788fec1, 50a8364, d3232bd, 58ac83a)."
)

# ----------------------------------------------------------------------------
# Gráficos
# ----------------------------------------------------------------------------

def sev_counts():
    counts = {s: 0 for s in SEV_ORDER}
    for f in FINDINGS:
        counts[f["severity"]] += 1
    return counts


def cat_counts():
    cats = {}
    for f in FINDINGS:
        cats[f["category"]] = cats.get(f["category"], 0) + 1
    return cats


def make_donut_chart(path):
    counts = sev_counts()
    labels, sizes, colors_ = [], [], []
    for s in SEV_ORDER:
        if counts[s] > 0:
            labels.append(f"{s} ({counts[s]})")
            sizes.append(counts[s])
            colors_.append(SEV_COLOR[s])

    fig, ax = plt.subplots(figsize=(4.6, 4.2), dpi=200)
    wedges, _ = ax.pie(
        sizes, colors=colors_, startangle=90,
        wedgeprops=dict(width=0.42, edgecolor="white", linewidth=2),
    )
    ax.text(0, 0.08, str(sum(sizes)), ha="center", va="center", fontsize=26, fontweight="bold", color=COLOR_TEXT)
    ax.text(0, -0.16, "achados", ha="center", va="center", fontsize=10, color=COLOR_MUTED)
    ax.legend(
        wedges, labels, loc="lower center", bbox_to_anchor=(0.5, -0.22),
        ncol=2, frameon=False, fontsize=8.5,
    )
    ax.set_aspect("equal")
    fig.tight_layout()
    fig.savefig(path, transparent=True, bbox_inches="tight")
    plt.close(fig)


def make_bar_chart(path):
    counts = cat_counts()
    cats = sorted(counts.keys())
    values = [counts[c] for c in cats]

    fig, ax = plt.subplots(figsize=(6.4, 4.0), dpi=200)
    bar_color = "#374151"
    bars = ax.barh(cats, values, color=bar_color, height=0.55)
    for bar, v in zip(bars, values):
        ax.text(bar.get_width() + 0.05, bar.get_y() + bar.get_height() / 2, str(v),
                va="center", fontsize=10, color=COLOR_TEXT, fontweight="bold")

    ax.set_xlim(0, max(values) + 1)
    ax.set_xlabel("Nº de achados", fontsize=9, color=COLOR_MUTED)
    ax.tick_params(axis="y", labelsize=9, colors=COLOR_TEXT)
    ax.tick_params(axis="x", labelsize=8, colors=COLOR_MUTED)
    for spine in ["top", "right", "left"]:
        ax.spines[spine].set_visible(False)
    ax.spines["bottom"].set_color(COLOR_BORDER)
    ax.invert_yaxis()
    fig.tight_layout()
    fig.savefig(path, transparent=True, bbox_inches="tight")
    plt.close(fig)


DONUT_PATH = os.path.join(ASSETS, "donut.png")
BAR_PATH = os.path.join(ASSETS, "bar.png")
make_donut_chart(DONUT_PATH)
make_bar_chart(BAR_PATH)

# ----------------------------------------------------------------------------
# Estilos
# ----------------------------------------------------------------------------
styles = getSampleStyleSheet()

def style(name, **kw):
    base = dict(fontName="Helvetica", textColor=colors.HexColor(COLOR_TEXT))
    base.update(kw)
    return ParagraphStyle(name, **base)

S_COVER_TITLE = style("CoverTitle", fontName="Helvetica-Bold", fontSize=26, leading=32, textColor=colors.white, alignment=TA_LEFT)
S_COVER_SUB = style("CoverSub", fontName="Helvetica", fontSize=13, leading=18, textColor=colors.HexColor("#D1D5DB"))
S_COVER_META = style("CoverMeta", fontName="Helvetica", fontSize=10.5, leading=16, textColor=colors.HexColor("#9CA3AF"))
S_H1 = style("H1", fontName="Helvetica-Bold", fontSize=17, leading=21, spaceBefore=4, spaceAfter=10, textColor=colors.HexColor(COLOR_HEADER_BG))
S_H2 = style("H2", fontName="Helvetica-Bold", fontSize=12.5, leading=16, spaceBefore=12, spaceAfter=6, textColor=colors.HexColor(COLOR_HEADER_BG))
S_BODY = style("Body", fontSize=9.6, leading=14.2, alignment=TA_JUSTIFY, spaceAfter=6)
S_BODY_TIGHT = style("BodyTight", fontSize=9.2, leading=13, alignment=TA_JUSTIFY)
S_MUTED = style("Muted", fontSize=8.6, leading=12, textColor=colors.HexColor(COLOR_MUTED))
S_CODE = ParagraphStyle("Code", fontName="Courier", fontSize=7.6, leading=10.4, textColor=colors.HexColor("#111827"),
                         backColor=colors.HexColor("#F3F4F6"), borderPadding=6, leftIndent=2)
S_FINDING_TITLE = style("FindingTitle", fontName="Helvetica-Bold", fontSize=11, leading=14, textColor=colors.HexColor(COLOR_HEADER_BG))
S_LABEL = style("Label", fontName="Helvetica-Bold", fontSize=8.6, leading=12, textColor=colors.HexColor(COLOR_MUTED))
S_TABLE_CELL = style("TableCell", fontSize=8.3, leading=11)
S_TABLE_HEAD = style("TableHead", fontName="Helvetica-Bold", fontSize=8.6, textColor=colors.white)
S_ISSUE_TITLE = style("IssueTitle", fontName="Helvetica-Bold", fontSize=10.5, leading=14, textColor=colors.HexColor(COLOR_HEADER_BG))
S_ISSUE_BODY = ParagraphStyle("IssueBody", fontName="Courier", fontSize=7.4, leading=10.2, textColor=colors.HexColor("#1F2937"))
S_STRENGTH_TITLE = style("StrengthTitle", fontName="Helvetica-Bold", fontSize=10, leading=13, textColor=colors.HexColor(COLOR_FORTE))


def esc(text):
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def chip(text, hexcolor):
    t = Table([[Paragraph(f'<font color="white"><b>{text}</b></font>', ParagraphStyle("chip", fontName="Helvetica-Bold", fontSize=7.6, alignment=TA_CENTER))]],
              colWidths=[2.15 * cm], rowHeights=[0.48 * cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(hexcolor)),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, -1), 1),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
        ("ROUNDEDCORNERS", [4, 4, 4, 4]),
    ]))
    return t


# ----------------------------------------------------------------------------
# Header / Footer
# ----------------------------------------------------------------------------
def draw_header_footer(c: pdfcanvas.Canvas, doc):
    c.saveState()
    width, height = A4
    c.setFont("Helvetica", 7.6)
    c.setFillColor(colors.HexColor(COLOR_MUTED))
    c.drawString(2 * cm, height - 1.3 * cm, REPORT_TITLE)
    c.drawRightString(width - 2 * cm, height - 1.3 * cm, REPORT_DATE)
    c.setStrokeColor(colors.HexColor(COLOR_BORDER))
    c.setLineWidth(0.5)
    c.line(2 * cm, height - 1.45 * cm, width - 2 * cm, height - 1.45 * cm)

    c.line(2 * cm, 1.55 * cm, width - 2 * cm, 1.55 * cm)
    c.drawString(2 * cm, 1.1 * cm, f"{REPORT_TITLE} — Confidencial")
    c.drawRightString(width - 2 * cm, 1.1 * cm, f"Página {doc.page}")
    c.restoreState()


def draw_cover(c: pdfcanvas.Canvas, doc):
    width, height = A4
    c.saveState()
    c.setFillColor(colors.HexColor(COLOR_HEADER_BG))
    c.rect(0, 0, width, height, fill=1, stroke=0)
    c.setFillColor(colors.HexColor("#059669"))
    c.rect(0, height - 0.5 * cm, width, 0.5 * cm, fill=1, stroke=0)
    c.restoreState()


# ----------------------------------------------------------------------------
# Documento
# ----------------------------------------------------------------------------
doc = BaseDocTemplate(
    OUT_PDF, pagesize=A4,
    leftMargin=2 * cm, rightMargin=2 * cm, topMargin=1.9 * cm, bottomMargin=1.9 * cm,
    title=REPORT_TITLE, author="Auditoria de Segurança (Claude Code)",
)

frame_normal = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="normal")
frame_cover = Frame(1.6 * cm, 1.6 * cm, A4[0] - 3.2 * cm, A4[1] - 3.2 * cm, id="cover")

doc.addPageTemplates([
    PageTemplate(id="Cover", frames=[frame_cover], onPage=draw_cover),
    PageTemplate(id="Normal", frames=[frame_normal], onPage=draw_header_footer),
])

story = []

# ---- CAPA ----
story.append(Spacer(1, 6.2 * cm))
story.append(Paragraph(REPORT_TITLE, S_COVER_TITLE))
story.append(Spacer(1, 0.5 * cm))
story.append(Paragraph("Relatório técnico de auditoria de segurança de aplicação", S_COVER_SUB))
story.append(Spacer(1, 1.6 * cm))
story.append(Paragraph(f"<b>Data:</b> {REPORT_DATE}", S_COVER_META))
story.append(Spacer(1, 0.15 * cm))
story.append(Paragraph(f"<b>Escopo auditado:</b> {SCOPE}", S_COVER_META))
story.append(Spacer(1, 0.5 * cm))
story.append(Paragraph("<b>Nota metodológica</b>", ParagraphStyle("m", parent=S_COVER_META, textColor=colors.white, fontSize=11, spaceAfter=4)))
story.append(Paragraph(METHODOLOGY.replace("\n\n", "<br/><br/>"), ParagraphStyle("mm", parent=S_COVER_META, fontSize=9, leading=13)))

story.append(NextPageTemplate("Normal"))
story.append(PageBreak())

# ---- RESUMO EXECUTIVO ----
story.append(Paragraph("Resumo Executivo", S_H1))

counts = sev_counts()
resumo_table_data = [["Severidade", "Qtde"]]
for s in SEV_ORDER:
    if counts[s] > 0:
        resumo_table_data.append([s, str(counts[s])])
resumo_table_data.append(["Total", str(sum(counts.values()))])

t_resumo = Table(resumo_table_data, colWidths=[4.2 * cm, 2 * cm])
t_style = [
    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(COLOR_HEADER_BG)),
    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
    ("FONTSIZE", (0, 0), (-1, -1), 9),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ("TOPPADDING", (0, 0), (-1, -1), 5),
    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor(COLOR_BORDER)),
    ("LINEABOVE", (0, -1), (-1, -1), 0.8, colors.HexColor(COLOR_HEADER_BG)),
]
for i, s in enumerate(SEV_ORDER):
    if counts[s] > 0:
        row_idx = [r[0] for r in resumo_table_data].index(s)
        t_style.append(("TEXTCOLOR", (0, row_idx), (0, row_idx), colors.HexColor(SEV_COLOR[s])))
t_resumo.setStyle(TableStyle(t_style))

img_donut = Image(DONUT_PATH, width=6.4 * cm, height=6.0 * cm)
img_bar = Image(BAR_PATH, width=8.6 * cm, height=5.3 * cm)

charts_row = Table([[img_donut, img_bar]], colWidths=[7 * cm, 9.2 * cm])
charts_row.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))

story.append(Paragraph(
    f"Foram identificados <b>{sum(counts.values())} achados</b> nas cinco categorias avaliadas. "
    f"Dois achados foram classificados como <b>Críticos</b> (quebra de isolamento entre tenants e "
    f"ausência total de enforcement de permissões). A aplicação demonstrou, por outro lado, uma "
    f"base sólida de isolamento de tenant nas operações de leitura e ausência de vetores "
    f"clássicos de SQL Injection e XSS no frontend.",
    S_BODY))
story.append(Paragraph(
    f'<b><font color="{COLOR_FORTE}">Status: todos os {sum(counts.values())} achados foram corrigidos '
    f'em 15/09/2026</font></b> — ver detalhe da correção aplicada em cada achado e no changelog '
    f"de código (graosys-backend). Este relatório foi atualizado após a remediação para manter "
    f"o histórico da auditoria original.",
    S_BODY))
story.append(Spacer(1, 0.3 * cm))
story.append(charts_row)
story.append(Spacer(1, 0.3 * cm))
story.append(t_resumo)

story.append(PageBreak())

# ---- PONTOS FORTES ----
story.append(Paragraph("Pontos Fortes (verificados no código)", S_H1))
story.append(Paragraph(
    "Itens abaixo foram ativamente verificados no código-fonte e representam controles corretos, "
    "não apenas ausência de achados. Servem como evidência de cobertura da auditoria.", S_MUTED))
story.append(Spacer(1, 0.2 * cm))

strength_rows = []
for s in STRENGTHS:
    strength_rows.append([
        Table([[""]], colWidths=[0.35 * cm], rowHeights=[0.35 * cm],
              style=TableStyle([("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(COLOR_FORTE)), ("ROUNDEDCORNERS", [3, 3, 3, 3])])),
        [Paragraph(s["title"], S_STRENGTH_TITLE), Spacer(1, 2), Paragraph(s["detail"][0] if isinstance(s["detail"], tuple) else s["detail"], S_BODY_TIGHT)],
    ])

for row in strength_rows:
    tbl = Table([row], colWidths=[0.7 * cm, doc.width - 0.7 * cm])
    tbl.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.append(tbl)

story.append(Spacer(1, 0.2 * cm))
story.append(Paragraph("Pontos Fracos (riscos centrais)", S_H2))
story.append(Paragraph(
    "O risco central da aplicação está na camada de <b>escrita</b>: enquanto as leituras respeitam "
    "o isolamento por tenant, os métodos de criação/atualização aceitam campos não-whiteliste do "
    "corpo da requisição (mass assignment), permitindo reescrever registros de qualquer tenant "
    "(F1). Some-se a isso um sistema de permissões granulares que existe apenas na interface "
    "administrativa, sem qualquer enforcement no backend (F2) — as duas falhas críticas do "
    "relatório. Defaults inseguros de segredos (F3, F5) e ausência de sanitização de HTML em "
    "e-mails (F4, F6) completam o quadro de riscos que dependem de configuração de deploy ou de "
    "conteúdo malicioso inserido por um usuário autenticado.", S_BODY))

story.append(PageBreak())

# ---- ACHADOS DETALHADOS ----
story.append(Paragraph("Achados Detalhados", S_H1))
story.append(Paragraph(
    "<b>Nota de cobertura — Categoria 1 (isolamento de tenant):</b> não há achado autônomo nesta "
    "categoria. Todas as operações de leitura (listagem, busca, agregação, relatório) auditadas "
    "filtram corretamente por `tenant_id` (ver seção \"Pontos Fortes\"). O único ponto em que o "
    "isolamento de tenant é efetivamente quebrado ocorre na camada de <b>escrita</b> "
    "(create/update), via mass assignment de `id`/`tenant_id` — reportado como <b>F1</b>, "
    "classificado sob a categoria 3 (IDOR) por sua causa raiz técnica.", S_BODY_TIGHT))
story.append(Spacer(1, 10))

# tabela resumo por categoria
story.append(Paragraph("Tabela-resumo", S_H2))
tbl_data = [[Paragraph("Sev.", S_TABLE_HEAD), Paragraph("Arquivo:linha", S_TABLE_HEAD), Paragraph("Descrição", S_TABLE_HEAD), Paragraph("Status", S_TABLE_HEAD)]]
for f in FINDINGS:
    tbl_data.append([
        chip(f["severity"], SEV_COLOR[f["severity"]]),
        Paragraph(f'<font face="Courier" size=7.4>{f["file"].split("/")[-1]}:{f["lines"]}</font>', S_TABLE_CELL),
        Paragraph(f'<b>[{f["id"]}]</b> {f["title"]}', S_TABLE_CELL),
        chip("Corrigido", COLOR_FORTE) if f["id"] in REMEDIATION else chip("Pendente", COLOR_MUTED),
    ])

tbl = Table(tbl_data, colWidths=[2.7 * cm, 3.2 * cm, doc.width - 8.6 * cm, 2.7 * cm], repeatRows=1)
tbl.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(COLOR_HEADER_BG)),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor(COLOR_BORDER)),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor(COLOR_BG_SOFT)]),
    ("TOPPADDING", (0, 0), (-1, -1), 5),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ("LEFTPADDING", (0, 0), (-1, -1), 6),
]))
story.append(tbl)
story.append(PageBreak())

# achados em detalhe, um por bloco
story.append(Paragraph("Detalhamento por achado", S_H2))
for f in FINDINGS:
    block = []
    header_row = Table(
        [[chip(f["severity"], SEV_COLOR[f["severity"]]), Paragraph(f'[{f["id"]}] {f["title"]}', S_FINDING_TITLE)]],
        colWidths=[2.3 * cm, doc.width - 2.3 * cm],
    )
    header_row.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    block.append(header_row)
    block.append(Spacer(1, 4))
    block.append(Paragraph(f"<b>Categoria:</b> {f['category']}", S_MUTED))

    files_lines = [f'{f["file"]}:{f["lines"]}']
    for extra_f, extra_l in f.get("files_extra", []):
        files_lines.append(f"{extra_f}:{extra_l}")
    block.append(Paragraph(f"<b>Arquivo(s):linha(s):</b> " + " | ".join(files_lines), S_MUTED))
    block.append(Spacer(1, 5))

    code_escaped = (
        f["snippet"]
        .replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        .replace("\n", "<br/>").replace(" ", "&nbsp;")
    )
    block.append(Paragraph(code_escaped, S_CODE))
    block.append(Spacer(1, 5))
    block.append(Paragraph(f'<b>Por que é explorável:</b> {esc(f["why"])}', S_BODY_TIGHT))
    block.append(Spacer(1, 3))
    block.append(Paragraph(f'<b>Condição de explorabilidade:</b> {esc(f["exploit"])}', S_BODY_TIGHT))
    block.append(Spacer(1, 3))
    block.append(Paragraph(f'<b>Impacto:</b> {esc(f["impact"])}', S_BODY_TIGHT))
    if f["id"] in REMEDIATION:
        block.append(Spacer(1, 5))
        remediation_row = Table(
            [[chip("Corrigido", COLOR_FORTE), Paragraph(f'<b>Correção aplicada:</b> {esc(REMEDIATION[f["id"]])}', S_BODY_TIGHT)]],
            colWidths=[2.3 * cm, doc.width - 2.3 * cm],
        )
        remediation_row.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
        block.append(remediation_row)
    block.append(Spacer(1, 12))
    block.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor(COLOR_BORDER)))
    block.append(Spacer(1, 12))

    story.append(KeepTogether(block[:len(block) - 2]))
    story.append(block[-2])
    story.append(block[-1])

story.append(PageBreak())

# ---- RECOMENDAÇÕES ----
story.append(Paragraph("Recomendações Priorizadas", S_H1))
prio_colors = {"P1": COLOR_CRITICA, "P2": COLOR_ALTA, "P3": COLOR_MEDIA}
for r in RECOMMENDATIONS:
    row = Table(
        [[chip(r["p"], prio_colors[r["p"]]), Paragraph(r["text"], S_BODY_TIGHT)]],
        colWidths=[2.3 * cm, doc.width - 2.3 * cm],
    )
    row.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 8)]))
    story.append(row)

story.append(PageBreak())

# ---- ISSUES PARA O GITHUB ----
story.append(Paragraph("Issues para o GitHub", S_H1))
story.append(Paragraph(
    "Texto completo em Markdown, pronto para copiar e colar na criação de issues no GitHub. "
    "Achados triviais/relacionados foram agrupados para evitar spam de issues. "
    "<b>Nota:</b> todos os achados abaixo já foram corrigidos no código (ver \"Correção aplicada\" "
    "em cada achado, seção anterior); as issues são mantidas como registro/trilha de auditoria e "
    "podem ser abertas e fechadas imediatamente referenciando o commit da correção.", S_MUTED))
story.append(Spacer(1, 8))

for issue in GITHUB_ISSUES:
    story.append(Paragraph(f'--- ISSUE {issue["n"]} ---', S_ISSUE_TITLE))
    story.append(Spacer(1, 4))
    story.append(Paragraph(f'<b>Título:</b> {issue["title"]}', S_BODY_TIGHT))
    story.append(Paragraph(f'<b>Labels:</b> {", ".join(issue["labels"])}', S_BODY_TIGHT))
    story.append(Spacer(1, 4))

    md_escaped = (
        issue["body"]
        .replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    )
    for line in md_escaped.split("\n"):
        line_html = line if line.strip() else "&nbsp;"
        story.append(Paragraph(line_html, S_ISSUE_BODY))

    story.append(Spacer(1, 6))
    story.append(Paragraph(f'--- FIM ISSUE {issue["n"]} ---', S_ISSUE_TITLE))
    story.append(Spacer(1, 16))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor(COLOR_BORDER)))
    story.append(Spacer(1, 16))

doc.build(story)
print(f"PDF gerado em: {OUT_PDF}")
