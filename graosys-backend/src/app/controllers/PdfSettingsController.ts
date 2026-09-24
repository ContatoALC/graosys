import { Request, Response } from "express";
import { AppDataSource } from "../../database/data-source";
import { Tenant } from "../entities/Tenant";
import { TenantPdfSettings } from "../entities/TenantPdfSettings";
import { generateContractPdf } from "../../services/contractPdf";

const MAX_IMAGE_BYTES = 300 * 1024;
const POSITIONS = ["left", "center", "right"];
const DATA_URI_RE = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/;

// Valida data URI: tipo, tamanho e assinatura real do arquivo (não confia só no prefixo).
function validateImage(value: string): string | null {
  const m = DATA_URI_RE.exec(value);
  if (!m) return "Imagem deve ser PNG ou JPEG";
  const buf = Buffer.from(m[2], "base64");
  if (buf.length > MAX_IMAGE_BYTES) return "Imagem excede 300 KB";
  const isPng = m[1] === "png" && buf.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const isJpg = m[1] === "jpeg" && buf.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  return isPng || isJpg ? null : "Arquivo de imagem inválido";
}

export class PdfSettingsController {
  async get(req: Request, res: Response) {
    const s = await AppDataSource.getRepository(TenantPdfSettings).findOne({ where: { tenant_id: req.user.tenant_id } });
    return res.json(s);
  }

  // Campos de imagem: string = substitui, null = remove, ausente = mantém.
  async save(req: Request, res: Response) {
    const { logo_data, logo_position, logo_width, watermark_data, watermark_opacity, watermark_enabled } = req.body;
    const repo = AppDataSource.getRepository(TenantPdfSettings);
    let s = await repo.findOne({ where: { tenant_id: req.user.tenant_id } });
    if (!s) s = repo.create({ tenant_id: req.user.tenant_id, logo_data: null, watermark_data: null });

    for (const [field, value] of [["logo_data", logo_data], ["watermark_data", watermark_data]] as const) {
      if (value === undefined) continue;
      if (value === null) { s[field] = null; continue; }
      const err = typeof value === "string" ? validateImage(value) : "Imagem inválida";
      if (err) return res.status(400).json({ error: err });
      s[field] = value;
    }

    if (logo_position !== undefined) {
      if (!POSITIONS.includes(logo_position)) return res.status(400).json({ error: "Posição do logo inválida" });
      s.logo_position = logo_position;
    }
    if (logo_width !== undefined) s.logo_width = Math.min(Math.max(Number(logo_width) || 120, 40), 300);
    if (watermark_opacity !== undefined) s.watermark_opacity = Math.min(Math.max(Number(watermark_opacity) || 0.1, 0.03), 0.5);
    if (watermark_enabled !== undefined) s.watermark_enabled = Boolean(watermark_enabled) && Boolean(s.watermark_data);

    await repo.save(s);
    return res.json(s);
  }

  async preview(req: Request, res: Response) {
    const tenant = await AppDataSource.getRepository(Tenant).findOne({ where: { id: req.user.tenant_id } });
    if (!tenant) return res.status(404).json({ error: "Corretora não encontrada" });
    const layout = await AppDataSource.getRepository(TenantPdfSettings).findOne({ where: { tenant_id: tenant.id } });
    const sample: any = {
      number_contract: "EXEMPLO-0001", seller: ["Vendedor de Exemplo"], buyer: ["Comprador de Exemplo"],
      name_product: "Soja em grãos", crop: "2025/2026", quality: "Umidade 14%", type_quantity: "sc",
      quantity: 12500, type_currency: "BRL", price: 132.5, payment: "30 dias após retirada",
      pickup_location: "Rio Verde/GO", initial_pickup_date: "01/10/2026", final_pickup_date: "30/10/2026",
    };
    const pdf = await generateContractPdf(sample, tenant, "Vendedor", layout);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'inline; filename="previa-contrato.pdf"');
    return res.send(pdf);
  }
}
