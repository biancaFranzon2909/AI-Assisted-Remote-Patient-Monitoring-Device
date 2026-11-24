// ─── Input DTOs ───────────────────────────────────────────────────────────────

export interface BuscarLancamentosPorDataDTO {
  empresaId: string;
  colaboradorId: string;
  data: string;
}

export interface CreateDespesaDTO {
  empresaId: string;
  nomeDespesa: string;
  descricao?: string;
  valor: number;
  dataDespesa: string;
  colaboradorId: string;
  lancamentoId?: string;
}


export interface UpdateDespesaDTO {
  id: string;
  empresaId: string;
  status: number;
  cargo: string;
  projetoIds?: string[];
}

export interface GetDespesasDTO {
  empresaId: string;
  colaboradorId: string;
  dataInicio?: string;
  dataFim?: string;
}

export interface DeleteDespesaDTO {
  id: string;
  empresaId: string;
  /** Usuário autenticado (ator): define o escopo pelo cargo. */
  usuarioId: string;
}

// ─── Output DTOs ──────────────────────────────────────────────────────────────

export interface LancamentoPorDataOutput {
  id: string;
  horaInicio: string | Date;
  horaFim: string | Date;
  cliente: string;
  projeto: string;
  atividade: string;
}

export interface DespesaComLancamento {
  despesaId: string
  nomeDespesa: string
  descricao: string | null
  dataDespesa: Date
  valor: number
  nomeFantasia: string
}