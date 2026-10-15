import { Request, Response } from "express";
import { AppDataSource } from "../../database/data-source";
import { Product } from "../entities/Product";
import { ProductTable } from "../entities/ProductTable";
import { pickFields } from "../../utils/pickFields";
import { ContractTemplate } from "../entities/ContractTemplate";

const PRODUCT_ALLOWED_FIELDS: (keyof Product)[] = [
  "product_type", "name", "commission_seller", "type_commission_seller", "quality", "observation", "template_id",
];

// Modelo do produto precisa ser da corretora; vazio vira nulo. Arquivado só fica se já era o do produto.
async function validateTemplate(tenantId: string, input: Partial<Product>, current?: string | null): Promise<string | null> {
  if (input.template_id === undefined) return null;
  if (!input.template_id) { input.template_id = null; return null; }
  const t = await AppDataSource.getRepository(ContractTemplate).findOne({ where: { id: String(input.template_id), tenant_id: tenantId }, select: ["id", "active"] });
  if (!t) return "Modelo de contrato não encontrado";
  if (!t.active && t.id !== current) return "Este modelo de contrato está arquivado";
  return null;
}

const PRODUCT_TABLE_ALLOWED_FIELDS: (keyof ProductTable)[] = ["name", "product", "crop", "description", "prices"];

export class ProductController {
  async create(req: Request, res: Response) {
    const productRepo = AppDataSource.getRepository(Product);
    const existing = await productRepo.findOne({ where: { product_type: req.body.product_type, tenant_id: req.user.tenant_id } });
    if (existing) return res.status(400).json({ error: "Produto com este código já existe" });
    const input = pickFields<Product>(req.body, PRODUCT_ALLOWED_FIELDS);
    const templateError = await validateTemplate(req.user.tenant_id, input);
    if (templateError) return res.status(400).json({ error: templateError });
    const product = productRepo.create({ ...input, tenant_id: req.user.tenant_id });
    await productRepo.save(product);
    return res.status(201).json(product);
  }

  async getAll(req: Request, res: Response) {
    const productRepo = AppDataSource.getRepository(Product);
    const products = await productRepo.find({ where: { tenant_id: req.user.tenant_id }, order: { name: "ASC" } });
    return res.json(products);
  }

  async getById(req: Request, res: Response) {
    const productRepo = AppDataSource.getRepository(Product);
    const product = await productRepo.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });
    if (!product) return res.status(404).json({ error: "Produto não encontrado" });
    return res.json(product);
  }

  async update(req: Request, res: Response) {
    const productRepo = AppDataSource.getRepository(Product);
    const product = await productRepo.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });
    if (!product) return res.status(404).json({ error: "Produto não encontrado" });
    const input = pickFields<Product>(req.body, PRODUCT_ALLOWED_FIELDS);
    const templateError = await validateTemplate(req.user.tenant_id, input, product.template_id);
    if (templateError) return res.status(400).json({ error: templateError });
    Object.assign(product, input);
    await productRepo.save(product);
    return res.json(product);
  }

  async delete(req: Request, res: Response) {
    const productRepo = AppDataSource.getRepository(Product);
    const product = await productRepo.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });
    if (!product) return res.status(404).json({ error: "Produto não encontrado" });
    await productRepo.remove(product);
    return res.status(204).send();
  }
}

export class ProductTableController {
  async create(req: Request, res: Response) {
    const tableRepo = AppDataSource.getRepository(ProductTable);
    const table = tableRepo.create({ ...pickFields<ProductTable>(req.body, PRODUCT_TABLE_ALLOWED_FIELDS), tenant_id: req.user.tenant_id });
    await tableRepo.save(table);
    return res.status(201).json(table);
  }

  async getAll(req: Request, res: Response) {
    const tableRepo = AppDataSource.getRepository(ProductTable);
    const tables = await tableRepo.find({ where: { tenant_id: req.user.tenant_id }, order: { created_at: "DESC" } });
    return res.json(tables);
  }

  async getById(req: Request, res: Response) {
    const tableRepo = AppDataSource.getRepository(ProductTable);
    const table = await tableRepo.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });
    if (!table) return res.status(404).json({ error: "Mesa não encontrada" });
    return res.json(table);
  }

  async update(req: Request, res: Response) {
    const tableRepo = AppDataSource.getRepository(ProductTable);
    const table = await tableRepo.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });
    if (!table) return res.status(404).json({ error: "Mesa não encontrada" });
    Object.assign(table, pickFields<ProductTable>(req.body, PRODUCT_TABLE_ALLOWED_FIELDS));
    await tableRepo.save(table);
    return res.json(table);
  }

  async delete(req: Request, res: Response) {
    const tableRepo = AppDataSource.getRepository(ProductTable);
    const table = await tableRepo.findOne({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });
    if (!table) return res.status(404).json({ error: "Mesa não encontrada" });
    await tableRepo.remove(table);
    return res.status(204).send();
  }
}
