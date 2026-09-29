import { Request, Response } from "express";
import { LookupNotFound, lookupCep, lookupCnpj } from "../../services/brasilApi";

// Autopreenchimento de cadastro a partir de dados públicos (Receita e Correios, via BrasilAPI).
export class LookupController {
  async cnpj(req: Request, res: Response) {
    return respond(res, () => lookupCnpj(req.params.cnpj), "CNPJ não encontrado");
  }

  async cep(req: Request, res: Response) {
    return respond(res, () => lookupCep(req.params.cep), "CEP não encontrado");
  }
}

async function respond(res: Response, fn: () => Promise<unknown>, notFound: string) {
  try {
    return res.json(await fn());
  } catch (err) {
    if (err instanceof LookupNotFound) return res.status(404).json({ error: notFound });
    console.error(err);
    return res.status(502).json({ error: "Serviço de consulta indisponível. Preencha manualmente." });
  }
}
