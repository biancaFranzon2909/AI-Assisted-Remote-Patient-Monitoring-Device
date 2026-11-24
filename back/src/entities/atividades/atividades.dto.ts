// ─── Input DTOs ───────────────────────────────────────────────────────────────

import { Prioridades, TipoAtividade, StatusProjeto, TipoLancamento } from "@prisma/client";

export interface CreateAtividadeDTO {
  empresaId: string;
  nomeAtividade: string;
  prioridade: Prioridades;
  descrAtividade?: string;
  dataPrevistaInicio: string;
  dataPrevistaFim: string;
  horasPrevistas?: number;
  tipoAtividade: TipoAtividade
  projetoId: string;
  refCliente?: string; 
  centroCusto?: string;
  solicitante?: string;
}

export interface UpdateAtividadeDTO {
  id: string;
  empresaId: string;
  nomeAtividade: string;
  prioridade: Prioridades;
  descrAtividade: string;
  dataPrevistaInicio: string;
  dataPrevistaFim: string;
  tipoAtividade: TipoAtividade;
  refCliente?: string; 
  horasPrevistas?: number;
  centroCusto?: string;
  solicitante?: string;
  isActive?: boolean;
}

export interface GetAtividadesDTO {
  empresaId: string;
  /** Usuário autenticado (ator): define quais lançamentos aparecem no detalhe. */
  usuarioId: string;
  atividadeId?: string;
}

export interface DeleteAtividadeDTO {
  id: string;
  empresaId: string;
}

// ─── Output DTOs ──────────────────────────────────────────────────────────────
export interface AtividadeLancamento {
  id: string;
  usuario_id: string;
  data_lancamento: Date;
  hora_inicio: Date;
  hora_fim: Date;
  duracao_total: number | null;
  descricao: string | null;
  tipo_lancamento: TipoLancamento | null;
}

export interface AtividadeDetail {
  clienteId:string;
  nomeAtividade: string;
  descrAtividade: string | null;
  /** Últimos 5 lançamentos visíveis ao ator (campos em snake_case, como antes). */
  lancamentos: AtividadeLancamento[];
  prioridade: Prioridades;
  previsaoInicio: Date | null;
  previsaoFim: Date | null;
  horasPrevistas: number | "Em Aberto";
  refCliente: string | null;
  horasGastas: number | null;
  tipoAtividade: TipoAtividade;
  limiteExcedido: boolean;
  projeto: {
    projetoId: string;
    status: StatusProjeto;
    nomeProjeto: string;
    solicitante: string | null;
    centroCusto: string | null;
    cliente: { clienteId: string; nomeFantasia: string } | null;
  } | null;
  isActive: boolean;
  centroCusto: string | null;
  solicitante: string | null;
  compartilhado: boolean;
}

export interface AtividadesList {
  atividadeId: string;
  nomeProjeto: string; 
  nomeAtividade: string; 
  nomeFantasia: string; 
  previsaoInicio: Date | null;
  previsaoFim: Date | null;
  horasPrevistas: number | null; 
  refCliente: string | null;
  horasGastas: number | null; 
  prioridade: Prioridades | null;
  centroCusto: string | null;
  solicitante: string | null;
  isActive: boolean;
  compartilhado?: boolean;
}