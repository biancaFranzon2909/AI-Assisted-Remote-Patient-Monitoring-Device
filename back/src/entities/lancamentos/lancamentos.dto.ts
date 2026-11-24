// ─── Input DTOs ───────────────────────────────────────────────────────────────

export interface GetLancamentosDTO {
  empresaId: string;
  from?: string;
  limit?: string;
  usuarioId: string;
  ano: number;
  mes: number;
  lancamentoId?: string;
  projetoId?: string;
  dataInicio?: string;
  dataFim?: string;
}

export interface GetNewInfoLancamentosDTO {
  empresaId: string;
  colaboradorId: string;
}

export interface CreateLancamentoDTO {
  empresaId: string;
  atividadeId: string;
  clienteId:string; 
  projetoId: string;
  userId: string;
  dataLancamento: string;
  descricao?: string;
  horaInicio: string;
  horaFim: string;
}

export interface UpdateLancamentoDTO {
  id: string;
  empresaId: string;
  /** Usuário autenticado (ator): define o escopo pelo cargo. */
  usuarioId: string;
  dataLancamento: string;
  horaInicio: string;
  horaFim: string;
  descricao?: string;
  motivoEdicao?: string;
  atividadeId: string;
  clienteId:string; 
  projetoId: string;
}

export interface UpdateLancamentoStatusDTO {
  id: string;
  empresaId: string;
  status: string;
  cargo?: string;
}

// ─── Output DTOs ──────────────────────────────────────────────────────────────
export interface LancamentoOutputById {
  descricao: string;
  projetoId: string;
  atividadeId: string;
  dataLancamento: Date;
  horaInicio: Date;
  horaFim: Date;
  nomeProjeto: string;
  nomeUsuario: string;
  usuarioId: string;
  nomeFantasia: string;
  clienteId: string;
  nomeAtividade: string;
  duracao: number;
  despesas?: [];
  compartilhado?: boolean;
}

export interface LancamentoOutputList {
  lancamentoId: string;
  nomeAtividade: string;
  nomeProjeto: string;
  nomeFantasia: string;
  duracaoTotal: number | null;
  dataLancamento: Date;
  horaInicio: Date | null;
  horaFim: Date | null;
  // statusAprovacao: string;
}

export interface LancamentosNewInfo {
  clientes: { id: string; nome: string; compartilhado?: boolean }[];
  projetos: { id: string; nome: string; clienteId: string; limiteAtingido?: boolean; compartilhado?: boolean }[];
  atividades: { id: string; nome: string; projetoId: string; limiteAtingido?: boolean; compartilhado?: boolean, refCliente: string }[];
}