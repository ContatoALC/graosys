import { Request, Response } from "express";
import { AppDataSource } from "../../database/data-source";
import { Product } from "../entities/Product";
import { ProductTable } from "../entities/ProductTable";

export class ProductController {
  async create(req: Request, res: Response) {
    const productRepo = AppDataSource.getRepository(Product);
    const existing = await productRepo.findOne({ where: { product_type: req.body.product_type, tenant_id: req.user.tenant_id } });
    if (existing) return res.status(400).json({ error: "Produto com este código já existe" });
    const product = productRepo.create({ ...req.body, tenant_id: req.user.tenant_id });
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
    Object.assign(product, req.body);
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
    const table = tableRepo.create({ ...req.body, tenant_id: req.user.tenant_id });
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
    Object.assign(table, req.body);
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
