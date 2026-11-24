import crypto from "crypto";
import jwt, { SignOptions } from "jsonwebtoken";
import { argon2 } from "@/lib/argon";
import { AppError } from "@/lib/errors/AppError";
import type {
  AuthenticateDTO,
  AuthTokensResult,
  RefreshTokenDTO,
  ResetDTO,
  RefreshTokenResult,
  LogoutDTO,
  VerifyResetDTO,
} from "./auth.dto";
import prisma from "@/prisma";
import { env } from "node:process";
import resend from "@/lib/mailer";

// ─── Config helpers ───────────────────────────────────────────────────────────

const DEFAULT_ACCESS_TOKEN_EXPIRES_IN = "15h";
const DEFAULT_REFRESH_TOKEN_TTL_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function getJwtSecret(): string {
  const secret = env.JWT_SECRET;
  if (!secret) throw new AppError("[SECRET_NOT_CONFIGURED]", 500);
  return secret;
}

function getAccessTokenExpiresIn(): string {
  const value = env.ACCESS_TOKEN_EXPIRES_IN;
  return value && value.trim() ? value.trim() : DEFAULT_ACCESS_TOKEN_EXPIRES_IN;
}

function parseDurationToMs(value: string): number | null {
  const match = /^\s*(\d+)\s*([smhd])?\s*$/i.exec(value);
  if (!match) return null;
  const amount = Number.parseInt(match[1], 10);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const unit = (match[2] ?? "s").toLowerCase();
  switch (unit) {
    case "s":
      return amount * 1000;
    case "m":
      return amount * 60 * 1000;
    case "h":
      return amount * 60 * 60 * 1000;
    case "d":
      return amount * 24 * 60 * 60 * 1000;
    default:
      return null;
  }
}

export function getAccessTokenTtlMs(): number {
  const parsed = parseDurationToMs(getAccessTokenExpiresIn());
  return (
    parsed ??
    parseDurationToMs(DEFAULT_ACCESS_TOKEN_EXPIRES_IN) ??
    3 * 60 * 60 * 1000
  );
}

export function getRefreshTokenTtlMs(): number {
  const value = Number(env.REFRESH_TOKEN_TTL_DAYS) ?? 1;
  const ttlDays =
    Number.isFinite(value) && value > 0
      ? value
      : DEFAULT_REFRESH_TOKEN_TTL_DAYS;
  return ttlDays * MS_PER_DAY;
}

// ─── Crypto helpers ───────────────────────────────────────────────────────────

function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function generateRefreshToken(): string {
  return crypto
    .randomBytes(32)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

// ─── JWT helper ───────────────────────────────────────────────────────────────
// apiKey e um parametro para criar uma chave de api sem expiresIn
function signAccessToken(usuario: Usuario, apiKey: boolean = false): string {
  const jwtSecret = getJwtSecret();
  const signOptions: SignOptions = apiKey
    ? {}
    : { expiresIn: getAccessTokenExpiresIn() as SignOptions["expiresIn"] };

  return jwt.sign(
    {
      type: "access",
      usuario_id: usuario.id,
      nome_usuario: usuario.nome_usuario,
    },
    jwtSecret,
    signOptions,
  );
}

// ─── Service operations ───────────────────────────────────────────────────────
const authenticate = async (
  dto: AuthenticateDTO,
): Promise<AuthTokensResult> => {
  const { nome_usuario, senha, ip, device_info } = dto;

  const usuario = await prisma.usuario.findFirst({
    where: { OR: [{ nome_usuario }, { email: nome_usuario }] },
    select: {
      hash_senha: true,
      id: true,
      nome_usuario: true,
      is_active: true,
      api_key: true,
    },
  });

  if (!usuario || !usuario.is_active) {
    throw new AppError("Login ou senha inválidos.", 401);
  }

  // cria esta chave apenas na primeira autenticacao no sistema
  if (!usuario.api_key) {
    await prisma.apiKey.create({
      data: {
        usuario_id: usuario.id,
        key: signAccessToken(usuario, true),
      },
    });
  }

  const senhaValida = await argon2.verify(usuario.hash_senha, senha);
  if (!senhaValida) {
    throw new AppError("Login ou senha inválidos.", 401);
  }

  const token = signAccessToken(usuario);
  const refreshToken = generateRefreshToken();
  const tokenHash = sha256Hex(refreshToken);
  const refreshTokenTtlMs = getRefreshTokenTtlMs();

  const now = new Date();
  const expiresAt = new Date(now.getTime() + refreshTokenTtlMs);

  await prisma.token.create({
    data: {
      token_hash: tokenHash,
      device_info: device_info ?? null,
      ip_address: ip ?? null,
      expires_at: expiresAt,
      usuario_id: usuario.id,
    },
  });

  return {
    token,
    refreshToken,
    accessTokenTtlMs: getAccessTokenTtlMs(),
    refreshTokenTtlMs,
  };
};

const refreshToken = async (
  dto: RefreshTokenDTO,
): Promise<RefreshTokenResult> => {
  const { refreshToken: refreshTokenValue } = dto;

  const tokenHash = sha256Hex(refreshTokenValue);
  const now = new Date();

  const stored = await prisma.token.findFirst({
    where: { token_hash: tokenHash, revoked_at: null, expires_at: { gt: now } },
  });

  if (!stored) {
    throw new AppError("Refresh token inválido.", 401);
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: stored.usuario_id },
  });

  if (!usuario || !usuario.is_active) {
    throw new AppError("Refresh token inválido.", 401);
  }

  const newRefreshToken = generateRefreshToken();
  const newTokenHash = sha256Hex(newRefreshToken);
  const refreshTokenTtlMs = getRefreshTokenTtlMs();
  const newExpiresAt = new Date(now.getTime() + refreshTokenTtlMs);

  await prisma.$transaction(async (tx) => {
    const updated = await tx.token.updateMany({
      where: { id: stored.id, revoked_at: null },
      data: { revoked_at: now },
    });

    if (updated.count === 0) throw new Error("REFRESH_TOKEN_REVOKED");

    await tx.token.create({
      data: {
        token_hash: newTokenHash,
        device_info: stored.device_info,
        ip_address: stored.ip_address,
        expires_at: newExpiresAt,
        usuario_id: stored.usuario_id,
      },
    });
  });

  const token = signAccessToken(usuario);

  return {
    token,
    newRefreshToken,
    accessTokenTtlMs: getAccessTokenTtlMs(),
    refreshTokenTtlMs,
  };
};

const logout = async (dto: LogoutDTO): Promise<void> => {
  const { refreshToken: refreshTokenValue } = dto;

  if (!refreshTokenValue) return;

  const tokenHash = sha256Hex(refreshTokenValue);
  const now = new Date();

  await prisma.token.updateMany({
    where: { token_hash: tokenHash, revoked_at: null },
    data: { revoked_at: now },
  });
};

// ------------ Trocar senha - logica em cache mapping
const mudancaSenhaCache = new Map<
  string,
  { codigo: string; expiraEm: number }
>();

const gerarCodigo = (id: string, reset: boolean = false): string => {
  const codigo = crypto.randomBytes(4).toString("hex").toUpperCase();
  const expiraEm = Date.now() + 5 * 60 * 1000; //5 minutos

  reset && mudancaSenhaCache.get(id)?.codigo
    ? mudancaSenhaCache.delete(id)
    : undefined;

  mudancaSenhaCache.set(id, { codigo, expiraEm });
  return codigo;
};

const validarCodigo = (id: string, code: string): void => {
  const registro = mudancaSenhaCache.get(id);

  if (!registro) {
    throw new AppError(
      "Nenhum código de recuperação encontrado ou expirado.",
      400,
    );
  }

  if (Date.now() > registro.expiraEm) {
    mudancaSenhaCache.delete(id);
    throw new AppError("O código de recuperação expirou.", 400);
  }

  if (registro.codigo !== code.trim().toUpperCase()) {
    throw new AppError("Código de recuperação inválido.", 400);
  }
};

/**
 * @param email Usado para achar o usuario e verificar id salvando o codigo enviado no cache local
 * @param reset Reseta o codigo enviado no email - esperado quadno o usuario pede um codigo novo
 * @param set Flag para receber a senha e setar ela
 */
const passwordReset = async (dto: ResetDTO) => {
  const usuario = await prisma.usuario.findUnique({
    where: { email: dto.email },
    select: { id: true, nome_completo: true },
  });

  if (!usuario)
    throw new AppError("Este e-mail não pertence a nenhum usuário.", 404);

  const codigo = await gerarCodigo(usuario.id, dto.reset);

  try {
    await resend.emails.create({
      from: `Chronotracker <contato${env.RESEND_MAIL}>`,
      to: dto.email,
      template: {
        id: "password-reset",
        variables: {
          codigo_senha: codigo,
          user_name: usuario.nome_completo,
        },
      },
    });
  } catch (error) {
    console.error("Erro ao enviar e-mail de recuperação:", error);
    throw new AppError("Falha ao enviar e-mail de recuperação de senha.", 500);
  }
};

// verifica se o codigo e email batem com o cache local e se o codigo nao expirou
const passwordResetVerify = async (dto: VerifyResetDTO) => {
  const { email, code, novaSenha } = dto;

  if (!novaSenha || novaSenha.length < 8) {
    throw new AppError("Insira uma senha de no mínimo 8 caracteres.", 400);
  }

  const user = await prisma.usuario.findUnique({
    where: { email },
    select: { id: true, nome_completo: true },
  });

  if (!user)
    throw new AppError("Este e-mail não pertence a nenhum usuário.", 404);

  await validarCodigo(user.id, code);
  // Se validar com sucesso

  const novaSenhaHash = await argon2.hash(novaSenha.trim());
  await prisma.usuario.update({
    where: { id: user.id },
    data: { hash_senha: novaSenhaHash },
  });

  mudancaSenhaCache.delete(user.id);
};

export const AuthService = {
  authenticate,
  refreshToken,
  logout,
  passwordReset,
  passwordResetVerify,
};
