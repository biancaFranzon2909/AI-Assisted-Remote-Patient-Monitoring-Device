// ─── Input DTOs ───────────────────────────────────────────────────────────────

export interface GetClientesDTO {
  is_active?: string;
  clienteId?: string;
  empresaId: string;
  /** Usuário autenticado (ator): COLAB só soma as despesas dos próprios lançamentos no detalhe. */
  usuarioId: string;
}

export interface CreateClienteDTO {
  cep?: string;
  cidade?: string;
  cnpj: string;
  email?: string;
  endereco?: string;
  estado?: string;
  inscricaoEstadual?: string;
  nomeFantasia?: string;
  notaInterna?: string;
  pais?: string;
  razaoSocial: string;
  website?: string;
  empresaId: string;
}

export interface UpdateClienteDTO {
  id: string;
  userId: string;
  empresaId: string;
  cep?: string;
  cidade?: string;
  cnpj?: string;
  email?: string;
  endereco?: string;
  estado?: string;
  inscricaoEstadual?: string;
  nomeFantasia?: string;
  notaInterna?: string;
  pais?: string;
  razaoSocial?: string;
  website?: string;
  status?: boolean;
  identificadorParceria?: string | null;
}

export interface DeleteClienteDTO {
  id: string;
  empresaId: string;
}

export interface GetClienteProjetosDTO {
  id: string;
  empresaId: string;
}

// ─── Output DTOs ──────────────────────────────────────────────────────────────

export interface ClienteListItem {
  clienteId: string;
  nomeFantasia: string;
  razaoSocial: string | null;
  email: string | null;
  localizacao: string;
  cnpj: string;
  cep: string | null;
  endereco: string | null;
  projetos: number;
  status: boolean;
  compartilhado?: boolean;
}
