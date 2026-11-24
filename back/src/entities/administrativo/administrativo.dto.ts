import { TipoAdministrativo } from "@prisma/client"

// ─── Input DTOs ───────────────────────────────────────────────────────────────
export interface CreateAdministrativoDTO {
  tipo: TipoAdministrativo
  titulo: string
  data_inicio: Date
  data_fim: Date
  usuarioId?: string
  empresaId: string
}

export interface GetAdministrativoDTO {
  empresaId: string
  usuarioId: string,
}

/** Campos editáveis; `empresaId` vem do usuário autenticado e só delimita o escopo (não é gravado). */
export interface UpdateAdministrativoDTO {
  id: string
  empresaId: string
  tipo?: TipoAdministrativo
  titulo?: string
  data_inicio?: Date
  data_fim?: Date
  usuarioId?: string
}

export interface AdministrativoIdDTO {
  id : string
  empresaId: string
}