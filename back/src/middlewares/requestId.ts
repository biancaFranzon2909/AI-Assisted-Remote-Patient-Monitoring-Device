import { randomUUID } from "node:crypto";
import { NextFunction, Request, Response } from "express";

const REQUEST_ID_HEADER = "X-Request-Id";
const REQUEST_ID_SEGURO = /^[A-Za-z0-9._:-]{1,100}$/;

/**
 * Identifica a requisição: reaproveita o `X-Request-Id` do cliente quando é curto e seguro,
 * senão gera um UUID. Fica em `req.requestId` e volta no header `X-Request-Id` da resposta.
 */
const requestIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const recebido = req.get(REQUEST_ID_HEADER);
  const requestId = recebido && REQUEST_ID_SEGURO.test(recebido) ? recebido : randomUUID();

  req.requestId = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);
  next();
};

export default requestIdMiddleware;
