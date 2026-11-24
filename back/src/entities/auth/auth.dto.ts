// ─── Input DTOs ───────────────────────────────────────────────────────────────
export interface ResetDTO {
  email: string;
  reset: boolean;
}

export interface VerifyResetDTO {
  email: string;
  code: string;
  novaSenha: string;
}

export interface AuthenticateDTO {
  nome_usuario: string;
  senha: string;
  ip?: string;
  device_info?: string | null;
}

export interface RefreshTokenDTO {
  refreshToken: string;
}

export interface LogoutDTO {
  refreshToken?: string;
}
// ─── Output DTOs ──────────────────────────────────────────────────────────────

export interface AuthTokensResult {
  token: string;
  refreshToken: string;
  accessTokenTtlMs: number;
  refreshTokenTtlMs: number;
}

export interface RefreshTokenResult {
  token: string;
  newRefreshToken: string;
  accessTokenTtlMs: number;
  refreshTokenTtlMs: number;
}
