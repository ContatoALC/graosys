import "reflect-metadata";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { AppDataSource, initializeDataSource } from "./data-source";
import { Tenant } from "../app/entities/Tenant";
import { User } from "../app/entities/User";

const TENANT_SLUG = process.env.SEED_TENANT_SLUG || "graosys-admin";
const TENANT_NAME = process.env.SEED_TENANT_NAME || "GraoSys Administração";
const ADMIN_NAME = process.env.SEED_ADMIN_NAME || "Administrador";
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || "admin@graosys.com";

async function seed() {
  await initializeDataSource(3, 1000);

  // Em produção o synchronize está desligado e o projeto não tem migrations:
  // se as tabelas ainda não existem (primeiro setup), cria o schema.
  const queryRunner = AppDataSource.createQueryRunner();
  const hasTables = await queryRunner.hasTable("tenants");
  await queryRunner.release();
  if (!hasTables) {
    console.log("Tabelas não encontradas, criando schema...");
    await AppDataSource.synchronize();
  }

  const tenantRepo = AppDataSource.getRepository(Tenant);
  const userRepo = AppDataSource.getRepository(User);

  let tenant = await tenantRepo.findOne({ where: { slug: TENANT_SLUG } });
  if (!tenant) {
    tenant = tenantRepo.create({
      slug: TENANT_SLUG,
      name: TENANT_NAME,
      email: ADMIN_EMAIL,
      status: "active",
      plan: "enterprise",
    });
    await tenantRepo.save(tenant);
    console.log(`Corretora criada: ${tenant.name} (${tenant.slug})`);
  }

  const existing = await userRepo.findOne({ where: { email: ADMIN_EMAIL, tenant_id: tenant.id } });
  if (existing) {
    console.log(`Usuário ${ADMIN_EMAIL} já existe, nada a fazer.`);
    return;
  }

  const generated = !process.env.SEED_ADMIN_PASSWORD;
  const password = process.env.SEED_ADMIN_PASSWORD || crypto.randomBytes(9).toString("base64url");

  const user = userRepo.create({
    tenant_id: tenant.id,
    name: ADMIN_NAME,
    email: ADMIN_EMAIL,
    password: await bcrypt.hash(password, 10),
    role: "admin",
    permissions: {},
    active: true,
  });
  await userRepo.save(user);

  console.log("Usuário administrador criado:");
  console.log(`  email: ${ADMIN_EMAIL}`);
  if (generated) console.log(`  senha: ${password}  (gerada, troque após o primeiro login)`);
  else console.log("  senha: definida em SEED_ADMIN_PASSWORD");
}

seed()
  .then(() => AppDataSource.destroy())
  .catch(async (err) => {
    console.error("Falha ao executar seed:", err);
    if (AppDataSource.isInitialized) await AppDataSource.destroy();
    process.exit(1);
  });
