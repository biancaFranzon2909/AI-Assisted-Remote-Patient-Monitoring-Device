import { Prisma } from "@prisma/client";

/**
 * Classe personalizada de erro, usada nos services (erro ascende ao controller)
 * @param message - Mensagem de erro
 * @param statusCode - Código de status HTTP (padrão: 400)
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly notFoundError: boolean;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.notFoundError = statusCode === 404;
  }
}

/**
 * Função para tratar erros de forma centralizada nos controllers.
 * @param res - Objeto de resposta do Express
 * @param error - Erro ocorrido
 * @param namedController - Nome do controller onde o erro ocorreu, ex: "EmpresasController"
 * @returns void
 */
export function errorHandler (res: response, error: unknown, namedController: string): void {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({ error: error.notFoundError ? false : true, message: error.message });
    return;
  }
  console.error(`[${namedController}] requestId=${res.req.requestId ?? "-"}`, resumoDoErro(error));
  res.status(500).json({ error: true, message: "Erro interno." });
};

/**
 * Resumo do erro para log: só `name`, `code`, `message` e `stack`.
 * Nunca o objeto inteiro (erros do Prisma carregam os argumentos da consulta, com dados pessoais).
 * `PrismaClientValidationError` só com `name`: a mensagem e o stack repetem os argumentos da consulta.
 */
export function resumoDoErro (error: unknown): { name?: string; code?: unknown; message?: string; stack?: string } {
  if (error instanceof Prisma.PrismaClientValidationError) {
    return { name: error.name };
  }
  if (error instanceof Error) {
    return {
      name: error.name,
      code: (error as Error & { code?: unknown }).code,
      message: error.message,
      stack: error.stack,
    };
  }
  return { message: typeof error === "string" ? error : "Erro sem detalhes." };
};