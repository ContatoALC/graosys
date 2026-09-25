import { Router } from "express";
import { authMiddleware, requireRole, requirePermission, requireSuperadmin } from "../middlewares/authMiddleware";
import { SessionController } from "../controllers/SessionController";
import { TenantController } from "../controllers/TenantController";
import { UserController } from "../controllers/UserController";
import { ClientController } from "../controllers/ClientController";
import { GrainContractController } from "../controllers/GrainContractController";
import { BillingController } from "../controllers/BillingController";
import { ProductController, ProductTableController } from "../controllers/ProductController";
import { DashboardController } from "../controllers/DashboardController";
import { BrokerController } from "../controllers/BrokerController";
import { EmailSettingsController } from "../controllers/EmailSettingsController";
import { PdfSettingsController } from "../controllers/PdfSettingsController";
import { AuditController } from "../controllers/AuditController";
import { auditMiddleware } from "../middlewares/auditMiddleware";
import { LeadController } from "../controllers/LeadController";
import { PlatformController } from "../controllers/PlatformController";
import { EmailController } from "../controllers/EmailController";

const router = Router();
const session = new SessionController();
const tenant = new TenantController();
const user = new UserController();
const client = new ClientController();
const contract = new GrainContractController();
const billing = new BillingController();
const product = new ProductController();
const productTable = new ProductTableController();
const dashboard = new DashboardController();
const email = new EmailController();
const platform = new PlatformController();
const lead = new LeadController();
const audit = new AuditController();
const pdfSettings = new PdfSettingsController();
const emailSettings = new EmailSettingsController();
const broker = new BrokerController();

// Público
router.post("/api/auth/login", session.login);
router.post("/api/tenants/register", tenant.register); // Cadastro de nova corretora

// Protegido (requer JWT)
router.use(authMiddleware);
router.use(auditMiddleware);

// Auth
router.post("/api/auth/heartbeat", session.heartbeat);
router.post("/api/auth/logout", session.logout);
router.post("/api/auth/reset-password", session.resetPassword);
router.get("/api/auth/profile", user.getProfile);

// Dashboard
router.get("/api/dashboard/management", requirePermission("reports", "view"), dashboard.getManagement);
router.get("/api/dashboard/summary", dashboard.getSummary);

// Tenant (dados da corretora logada)
router.get("/api/tenant", tenant.getCurrent);
router.patch("/api/tenant", requireRole("admin"), tenant.update);

// Usuários
router.get("/api/users", requireRole("admin"), user.getAll);
router.get("/api/users/:id", requireRole("admin"), user.getById);
router.post("/api/users", requireRole("admin"), user.create);
router.patch("/api/users/:id", requireRole("admin"), user.update);
router.delete("/api/users/:id", requireRole("admin"), user.delete);

// Clientes
router.get("/api/clients", requirePermission("clients", "view"), client.getAll);
router.get("/api/clients/:id", requirePermission("clients", "view"), client.getById);
router.get("/api/clients/cnpj/:cnpj_cpf", requirePermission("clients", "view"), client.getByCnpjCpf);
router.post("/api/clients", requirePermission("clients", "create"), client.create);
router.patch("/api/clients/:id", requirePermission("clients", "edit"), client.update);
router.delete("/api/clients/:id", requireRole("admin"), client.delete);

// Contratos de grãos
router.get("/api/contracts/report", requirePermission("reports", "view"), contract.getReport);
router.get("/api/contracts", requirePermission("contracts", "view"), contract.getAll);
router.get("/api/contracts/:id", requirePermission("contracts", "view"), contract.getById);
router.post("/api/contracts", requirePermission("contracts", "create"), contract.create);
router.post("/api/contracts/:id/clone", requirePermission("contracts", "create"), contract.clone);
router.get("/api/contracts/:id/email-logs", requirePermission("execution", "view"), email.logs);
router.patch("/api/contracts/:id", requirePermission("contracts", "edit"), contract.update);
router.patch("/api/contracts/:id/status", requirePermission("execution", "edit"), contract.updateStatus);
router.delete("/api/contracts/:id", requireRole("admin"), contract.delete);

// Recebimentos (Cobrança)
router.get("/api/billings/summary", requirePermission("billing", "view"), billing.getSummary);
router.get("/api/billings", requirePermission("billing", "view"), billing.getAll);
router.get("/api/billings/:id", requirePermission("billing", "view"), billing.getById);
router.get("/api/billings/contract/:number_contract", requirePermission("billing", "view"), billing.getByNumberContract);
router.post("/api/billings", requirePermission("billing", "create"), billing.create);
router.patch("/api/billings/:id", requirePermission("billing", "edit"), billing.update);
router.delete("/api/billings/:id", requireRole("admin"), billing.delete);

// Produtos (Admin)
router.get("/api/products", product.getAll);
router.get("/api/products/:id", product.getById);
router.post("/api/products", requireRole("admin"), product.create);
router.patch("/api/products/:id", requireRole("admin"), product.update);
router.delete("/api/products/:id", requireRole("admin"), product.delete);

// Brokers (Admin)
router.get("/api/brokers", broker.getAll);
router.get("/api/brokers/:id", broker.getById);
router.post("/api/brokers", requireRole("admin"), broker.create);
router.patch("/api/brokers/:id", requireRole("admin"), broker.update);
router.delete("/api/brokers/:id", requireRole("admin"), broker.delete);

// Auditoria e sessões da corretora (Admin)
router.get("/api/audit", requireRole("admin"), audit.list);
router.get("/api/audit/actions", requireRole("admin"), audit.actions);
router.get("/api/sessions/overview", requireRole("admin"), audit.sessions);

// Painel da plataforma (superadmin)
router.get("/api/platform/audit", requireSuperadmin, audit.platformList);
router.get("/api/platform/audit/actions", requireSuperadmin, audit.platformActions);
router.get("/api/platform/sessions/overview", requireSuperadmin, audit.platformSessions);
router.get("/api/platform/summary", requireSuperadmin, platform.summary);
router.get("/api/platform/plans", requireSuperadmin, platform.plans);
router.get("/api/platform/tenants", requireSuperadmin, platform.listTenants);
router.post("/api/platform/tenants", requireSuperadmin, platform.createTenant);
router.get("/api/platform/tenants/:id", requireSuperadmin, platform.getTenant);
router.patch("/api/platform/tenants/:id", requireSuperadmin, platform.updateTenant);
router.post("/api/platform/tenants/:id/users", requireSuperadmin, platform.createUser);
router.patch("/api/platform/users/:id", requireSuperadmin, platform.updateUser);
router.post("/api/platform/users/:id/reset-password", requireSuperadmin, platform.resetUserPassword);

// Prospecção (superadmin)
router.get("/api/platform/leads", requireSuperadmin, lead.list);
router.post("/api/platform/leads", requireSuperadmin, lead.create);
router.get("/api/platform/leads/:id", requireSuperadmin, lead.get);
router.patch("/api/platform/leads/:id", requireSuperadmin, lead.update);
router.delete("/api/platform/leads/:id", requireSuperadmin, lead.delete);

// Layout do PDF do contrato (Admin)
router.get("/api/pdf-settings", requireRole("admin"), pdfSettings.get);
router.put("/api/pdf-settings", requireRole("admin"), pdfSettings.save);
router.get("/api/pdf-settings/preview", requireRole("admin"), pdfSettings.preview);

// Configuração de e-mail da corretora (Admin)
router.get("/api/email-settings", requireRole("admin"), emailSettings.get);
router.put("/api/email-settings", requireRole("admin"), emailSettings.save);
router.post("/api/email-settings/test", requireRole("admin"), emailSettings.test);

// Email
router.get("/api/email/summary", requirePermission("execution", "view"), email.summary);
router.post("/api/email/send-contract", requirePermission("execution", "edit"), email.sendContractEmail);
router.post("/api/email/send-custom", requireRole("admin"), email.sendCustomEmail);

// Mesas de produtos (Admin)
router.get("/api/product-tables", productTable.getAll);
router.get("/api/product-tables/:id", productTable.getById);
router.post("/api/product-tables", requireRole("admin"), productTable.create);
router.patch("/api/product-tables/:id", requireRole("admin"), productTable.update);
router.delete("/api/product-tables/:id", requireRole("admin"), productTable.delete);

export default router;
