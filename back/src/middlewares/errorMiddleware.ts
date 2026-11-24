import { NextFunction, Request, Response } from "express";
import { AppError, resumoDoErro } from "@/lib/errors/AppError";

interface HttpErrorLike {
  type?: unknown;
  status?: unknown;
  statusCode?: unknown;
}

const asHttpError = (err: unknown): HttpErrorLike =>
  typeof err === "object" && err !== null ? (err as HttpErrorLike) : {};

/** Rota inexistente (registrado depois do router e antes do middleware de erro). */
export const notFoundMiddleware = (_req: Request, res: Response): void => {
  res.status(404).json({ error: true, message: "Rota não encontrada." });
};

/**
 * Último middleware do app: converte erros não tratados na resposta padrão `{ error, message }`.
 * Nunca devolve stack, SQL ou mensagem interna; o detalhe fica só no log, com o requestId.
 */
const errorMiddleware = (err: unknown, req: Request, res: Response, next: NextFunction): void => {
  if (res.headersSent) {
    next(err);
    return;
  }

  const requestId = req.requestId ?? "-";

  // Erro de regra lançado por service sem try/catch no controller: status e mensagem do próprio AppError
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: true, message: err.message });
    return;
  }

  const httpError = asHttpError(err);
  const rawStatus = httpError.status ?? httpError.statusCode;
  const status = typeof rawStatus === "number" ? rawStatus : 500;

  // Erros do express.json (body-parser). A mensagem pode conter trecho do corpo: não registrar.
  if (httpError.type === "entity.parse.failed") {
    console.warn(`[ErrorMiddleware] requestId=${requestId} JSON inválido`);
    res.status(400).json({ error: true, message: "JSON inválido." });
    return;
  }

  if (httpError.type === "entity.too.large") {
    console.warn(`[ErrorMiddleware] requestId=${requestId} corpo da requisição grande demais`);
    res.status(413).json({ error: true, message: "Corpo da requisição grande demais." });
    return;
  }

  // Outros erros HTTP 4xx (com status/statusCode): status preservado, mensagem genérica
  if (status >= 400 && status < 500) {
    console.warn(`[ErrorMiddleware] requestId=${requestId} requisição inválida (${status})`);
    res.status(status).json({ error: true, message: "Requisição inválida." });
    return;
  }

  // Sem o path: algumas rotas levam token no caminho (ex.: /convite/aceite/:token).
  console.error(`[ErrorMiddleware] requestId=${requestId} ${req.method}`, resumoDoErro(err));
  res.status(500).json({ error: true, message: "Erro interno." });
};

export default errorMiddleware;
