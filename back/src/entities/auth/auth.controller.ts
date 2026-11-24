import { CookieOptions } from "express";
import { errorHandler } from "@/lib/errors/AppError";
import { env } from "node:process";
import { AuthService, getAccessTokenTtlMs, getRefreshTokenTtlMs } from "./auth.service";
import { UsuariosService } from "../usuarios/usuarios.service";

// ─── Cookie helpers ───────────────────────────────────────────────────────────
const ACCESS_COOKIE_NAME = "_tk";
const REFRESH_COOKIE_NAME = "_rtk";

function getCookieOptions(maxAgeMs: number): CookieOptions {
  const isProduction = env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: maxAgeMs,
  } as CookieOptions;
}

function setAuthCookies(res: response, token: string, refreshToken: string): void {
  res.cookie(ACCESS_COOKIE_NAME, token, getCookieOptions(getAccessTokenTtlMs()));
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, getCookieOptions(getRefreshTokenTtlMs()));
}

function clearAuthCookies(res: response): void {
  const opts = getCookieOptions(0);
  res.clearCookie(ACCESS_COOKIE_NAME, opts);
  res.clearCookie(REFRESH_COOKIE_NAME, opts);
}

// ─── POST /auth/login ──────────────────────────────────────────────────────────────
const authenticate = async (req: request, res: response): Promise<void> => {
  const { nome_usuario, senha } = req.body ?? {};

  if (typeof nome_usuario !== "string" || typeof senha !== "string") {
    res.status(400).json({ error: true, message: "Dados inválidos." });
    return;
  }

  const userAgentHeader = req.headers["user-agent"];

  try {
    const result = await AuthService.authenticate({
      nome_usuario,
      senha,
      ip: req.ip,
      device_info: typeof userAgentHeader === "string" ? userAgentHeader : null,
    });

    setAuthCookies(res, result.token, result.refreshToken);
    res.status(200).json({ error: false, message: "Bem-vindo!" });
  } catch (error) {
    errorHandler(res, error, "AuthController");
  }
};

// ─── POST /auth/register ───────────────────────────────────────────────────────────
const register = async (req: request, res: response): Promise<void> => {
  const { nome_usuario, senha, nome_completo, email, identificador } = req.body ?? {};

  if (typeof nome_usuario !== "string" || typeof senha !== "string" || typeof nome_completo !== "string" || typeof email !== "string") {
    res.status(400).json({ error: true, message: "Dados inválidos." });
    return;
  }
  
  try {
    await UsuariosService.create({
      nomeUsuario: nome_usuario,
      senha,
      nomeCompleto: nome_completo,
      email,
    });

    res.status(201).json({ error: false, message: "Usuário registrado com sucesso." });
  } catch (error) {
    errorHandler(res, error, "AuthController");
  }
}

// ─── POST /auth/refresh-token ──────────────────────────────────────────────────────
const refreshToken = async (req: request, res: response): Promise<void> => {
  const refreshTokenValue = req.cookies?.[REFRESH_COOKIE_NAME];

  if (typeof refreshTokenValue !== "string" || !refreshTokenValue.trim()) {
    res.status(400).json({ error: true, message: "Refresh token inválido." });
    return;
  }

  try {
    const result = await AuthService.refreshToken({ refreshToken: refreshTokenValue });
    setAuthCookies(res, result.token, result.newRefreshToken);
    res.status(200).json({ error: false, message: "Token atualizado." });
  } catch (error) {
    errorHandler(res, error, "AuthController");
  }
};

// ─── POST /auth/logout ─────────────────────────────────────────────────────────────
const logout = async (req: request, res: response): Promise<void> => {
  const refreshTokenValue = req.cookies?.[REFRESH_COOKIE_NAME];

  if (refreshTokenValue && (typeof refreshTokenValue !== "string" || !refreshTokenValue.trim())) {
    res.status(400).json({ error: true, message: "Refresh token inválido." });
    return;
  }

  try {
    await AuthService.logout({ refreshToken: refreshTokenValue });
    clearAuthCookies(res);
    res.status(200).json({ error: false, message: "Logout realizado." });
  } catch (error) {
    errorHandler(res, error, "AuthController");
  }
};

// ─── POST /auth/password-reset ────────────────────────────────────────────────────────────
const passwordReset = async(req: request, res: response): Promise<void> => {
  const { email, reset = false } = req.body ?? {};

  if (typeof email !== "string" || !email.trim()) {
    res.status(400).json({ error: true, message: "E-mail inválido ou não fornecido." });
    return;
  }

  try {
    await AuthService.passwordReset({email, reset});
    res.status(200).json({
      error: false,
      message: "Código de recuperação enviado para o e-mail cadastrado.",
    });
  } catch (error) {
    errorHandler(res, error, "AuthController");
  }
};


// ─── POST /auth/password-reset-verify  ────────────────────────────────────────────────────────────
const passwordResetVerify = async(req: request, res: response): Promise<void> => {
  const { email, code, novaSenha } = req.body ?? {};

  if (typeof code !== "string" || !code.trim() || typeof email !== "string" || !email.trim()) {
    res.status(400).json({ error: true, message: "Ops! Algo de errado com seu codigo." });
    return;
  }

  try {
    await AuthService.passwordResetVerify({email, code, novaSenha});
    res.status(200).json({ error: false });
  } catch (error) {
    errorHandler(res, error, "AuthController");
  }
};

export default { authenticate, refreshToken, logout, register, passwordReset, passwordResetVerify };
