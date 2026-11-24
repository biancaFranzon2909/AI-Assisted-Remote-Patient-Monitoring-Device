// ─── Input DTOs ───────────────────────────────────────────────────────────────
export interface CreateEmpresaDTO {
  nomeEmpresa: string; 
  identificador?: string; 
  ownerId: string;
}

export interface DeleteCompanyDTO {
  // identificador: string;
  empresaId: string;
  usuarioId: string;
}

export interface RemoveUserFromCompanyDTO {
  userId: string;
  companyId: string;
  userIdRemoval?: string
}

export interface AddUserToCompanyDTO extends RemoveUserFromCompanyDTO {}