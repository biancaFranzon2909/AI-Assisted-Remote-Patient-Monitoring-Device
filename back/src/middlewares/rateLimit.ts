import type { Request } from "express";
import { ipKeyGenerator, rateLimit, type RateLimitRequestHandler } from "express-rate-limit";

// Store em memória: vale enquanto o PM2 roda um único processo (modo fork).
// Com mais de um processo, os contadores deixam de ser globais e é preciso store compartilhado.

const QUINZE_MINUTOS = 15 * 60 * 1000;
const UMA_HORA = 60 * 60 * 1000;

/** Chave por usuário autenticado (`req.user.usuario_id`, posto pelo authMiddleware); sem usuário, por IP. */
const chavePorUsuario = (req: Request): string => {
  const usuarioId = (req as request).user?.usuario_id;
  return typeof usuarioId === "string" && usuarioId
    ? `usuario:${usuarioId}`
    : `ip:${ipKeyGenerator(req.ip ?? "")}`;
};

const criarLimite = (
  windowMs: number,
  limit: number,
  skipSuccessfulRequests = false,
  keyGenerator?: (req: Request) => string,
): RateLimitRequestHandler =>
  rateLimit({
    windowMs,
    limit,
    skipSuccessfulRequests,
    ...(keyGenerator ? { keyGenerator } : {}),
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res, _next, options) => {
      res.status(options.statusCode).json({
        error: true,
        message: "Muitas tentativas. Tente novamente em alguns minutos.",
      });
    },
  });

/** Login: conta só as tentativas que falharam (escritório atrás de NAT compartilha IP). */
export const loginLimiter = criarLimite(QUINZE_MINUTOS, 10, true);
export const registerLimiter = criarLimite(UMA_HORA, 10);
export const passwordResetLimiter = criarLimite(QUINZE_MINUTOS, 5);
/** Verificação do código de recuperação: conta todas para dificultar força bruta. */
export const passwordResetVerifyLimiter = criarLimite(QUINZE_MINUTOS, 10);
/** Convite: por usuário, aplicado na rota depois do authMiddleware (src/router/index.ts). */
export const conviteLimiter = criarLimite(UMA_HORA, 15, false, chavePorUsuario);
/** Refresh é chamado por várias abas/dispositivos: limite folgado. */
export const refreshTokenLimiter = criarLimite(QUINZE_MINUTOS, 120);
