import { Router } from "express";
import { authMiddleware, requireRole } from "../middlewares/authMiddleware";
import { SessionController } from "../controllers/SessionController";
import { TenantController } from "../controllers/TenantController";
import { UserController } from "../controllers/UserController";
import { ClientController } from "../controllers/ClientController";
import { GrainContractController } from "../controllers/GrainContractController";
import { BillingController } from "../controllers/BillingController";
import { ProductController, ProductTableController } from "../controllers/ProductController";
import { DashboardController } from "../controllers/DashboardController";
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

// Público
router.post("/api/auth/login", session.login);
router.post("/api/tenants/register", tenant.register); // Cadastro de nova corretora

// Protegido (requer JWT)
router.use(authMiddleware);

// Auth
router.post("/api/auth/reset-password", session.resetPassword);
router.get("/api/auth/profile", user.getProfile);

// Dashboard
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
router.get("/api/clients", client.getAll);
router.get("/api/clients/:id", client.getById);
router.get("/api/clients/cnpj/:cnpj_cpf", client.getByCnpjCpf);
router.post("/api/clients", client.create);
router.patch("/api/clients/:id", client.update);
router.delete("/api/clients/:id", requireRole("admin"), client.delete);

// Contratos de grãos
router.get("/api/contracts/report", contract.getReport);
router.get("/api/contracts", contract.getAll);
router.get("/api/contracts/:id", contract.getById);
router.post("/api/contracts", contract.create);
router.patch("/api/contracts/:id", contract.update);
router.patch("/api/contracts/:id/status", contract.updateStatus);
router.delete("/api/contracts/:id", requireRole("admin"), contract.delete);

// Recebimentos (Cobrança)
router.get("/api/billings/summary", billing.getSummary);
router.get("/api/billings", billing.getAll);
router.get("/api/billings/:id", billing.getById);
router.get("/api/billings/contract/:number_contract", billing.getByNumberContract);
router.post("/api/billings", billing.create);
router.patch("/api/billings/:id", billing.update);
router.delete("/api/billings/:id", requireRole("admin"), billing.delete);

// Produtos (Admin)
router.get("/api/products", product.getAll);
router.get("/api/products/:id", product.getById);
router.post("/api/products", requireRole("admin"), product.create);
router.patch("/api/products/:id", requireRole("admin"), product.update);
router.delete("/api/products/:id", requireRole("admin"), product.delete);

// Email
router.post("/api/email/send-contract", email.sendContractEmail);
router.post("/api/email/send-custom", email.sendCustomEmail);

// Mesas de produtos (Admin)
router.get("/api/product-tables", productTable.getAll);
router.get("/api/product-tables/:id", productTable.getById);
router.post("/api/product-tables", requireRole("admin"), productTable.create);
router.patch("/api/product-tables/:id", requireRole("admin"), productTable.update);
router.delete("/api/product-tables/:id", requireRole("admin"), productTable.delete);

export default router;
