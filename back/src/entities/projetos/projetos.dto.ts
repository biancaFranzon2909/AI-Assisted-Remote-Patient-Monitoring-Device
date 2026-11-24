// ─── Input DTOs ───────────────────────────────────────────────────────────────
import { Prisma } from "@prisma/client";
import { Prioridades, StatusProjeto, TipoAtividade, TipoProjeto } from "@prisma/client";

export interface GetProjetosDTO {
  projetoId?: string;
  empresaId: string;
}

export interface CreateProjetoDTO {
  empresaId: string;
  clienteId?: string;
  nomeProjeto: string;
  descricao?: string;
  refCliente?: string;
  dataInicio: string;
  dataFim: string;
  status?: StatusProjeto;
  horasPrevistas: number | null;
  equipe?: string[];
  centroCusto?: string;
  solicitante?: string;
  tipoProjeto?: TipoProjeto;
}

export interface UpdateProjetoDTO {
  id: string;
  empresaId: string;
  clienteId?: string;
  nomeProjeto?: string;
  descricao?: string;
  refCliente?: string;
  dataInicio?: string;
  dataFim?: string;
  status?: StatusProjeto;
  horasPrevistas: number | null;
  equipe?: string[];
  centroCusto?: string;
  solicitante?: string;
  tipoProjeto?: TipoProjeto;
  isActive?: boolean;
}

export interface DeleteProjetoDTO {
  id: string;
  empresaId: string;
}

// ─── Output DTOs ──────────────────────────────────────────────────────────────
export interface ProjetoDetail {
  projetoId: string;
  nomeProjeto: string;
  refClienteProjeto: string | null;
  descricao: string | null;
  dataInicio: Date | null;
  dataFim: Date | null;
  horasGastas: number | null;
  horasPrevistas: number | "Em Aberto";
  status: StatusProjeto
  clienteId: string;
  nomeFantasia: string;
  compartilharComCliente: boolean;
  atividades: { 
    atividadeId: string, 
    nomeAtividade: string, 
    prioridade: Prioridades | null, 
    refClienteAtividade: string | null, 
    compartilhado: boolean
  }[];
  equipe: { usuarioId: string, nomeUsuario: string, nomeCompleto: string}[];
  centroCusto: string | null;
  solicitante: string | null;
  tipoProjeto: TipoProjeto;
  isActive: boolean;
  compartilhado: boolean;
}

export interface ProjetoList {
  projetoId: string; 
  nomeProjeto: string;  
  nomeFantasia: string; 
  status: StatusProjeto;
  limiteAtingido: boolean;
  refCliente: string;
  horasGastas: number;
  horasPrevistas: number; 
  dataInicio: Date;
  dataFim: Date;
  atividades: number;
  centroCusto: string | null;
  solicitante: string | null;
  tipoProjeto: TipoProjeto;
  isActive: boolean;
  compartilhado?: boolean;
}

// Campos comuns às duas queries (próprios e compartilhados)
export const projetoBaseSelect = {
  id: true,
  nome_projeto: true,
  data_inicio: true,
  data_fim: true,
  horas_gastas: true,
  horas_previstas: true,
  status: true,
  ref_cliente: true,
  centro_custo: true,
  solicitante: true,
  tipo: true,
  is_active: true,
  _count: { select: { atividades: true } },
} satisfies Prisma.projetoSelect;

export type ProjetoBase = Prisma.projetoGetPayload<{ select: typeof projetoBaseSelect }>;

