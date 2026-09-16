import { Request, Response, NextFunction } from "express";

// Loga o detalhe completo apenas no servidor; nunca repassa err.message cru
// ao cliente (pode conter detalhes internos de queries, stack, etc.).
export function errorMiddleware(err: Error, req: Request, res: Response, next: NextFunction) {
  console.error(err);
  return res.status(500).json({ error: "Erro interno do servidor" });
}
