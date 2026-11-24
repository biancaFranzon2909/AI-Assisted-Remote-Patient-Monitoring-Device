// ─── Input DTOs ───────────────────────────────────────────────────────────────

import { Cargos } from "@prisma/client";

export interface GetUsuariosDTO {
  /** Usuário consultado (alvo), quando a rota tem `:id`. */
  usuarioId?: string;
  empresaId: string;
  /** Usuário autenticado (ator): define o escopo pelo cargo. */
  atorId: string;
}

export interface UpdatePwdDTO {
  usuarioId: string;
  senhaAtual: string;
  senhaNova: string;
}

export interface CreateUsuarioDTO {
  nomeUsuario: string;
  senha: string;
  nomeCompleto: string;
  email: string;
}

export interface GetMeDTO {
  usuarioId: string;
}

export interface UserStatsDTO {
  /** Usuário consultado (alvo). */
  usuarioId: string;
  empresaId: string;
  /** Usuário autenticado (ator): define o escopo pelo cargo. */
  atorId: string;
}

export interface InactivateUsuarioDTO {
  usuarioId: string;
}

// ─── OutPuts DTOs ───────────────────────────────────────────────────────────────

export interface Me {
  id: string 
  apiKey: string
  email?: string
  isActive: boolean
  nomeCompleto: string
  nomeUsuario: string
  empresas?: { nomeEmpresa: string; identificador: string; cargo: string }[]
}

export interface UsuarioList {
  usuarioId: string
  nomeCompleto: string
  nomeUsuario: string 
  email: string | null
  cargo: Cargos
  isActive: boolean
}

export interface UsuarioById {
  id: string;
  nomeUsuario: string;
  nomeCompleto: string;
  email: string | null;
  isActive: boolean;
  cargo: Cargos;
  projetos: { projetoId: string; projetoNome: string, atividades: {atividadeId: string, nomeAtividade: string}[]}[];
  /** Vazio quando um COLAB consulta outro usuário. */
  lancamentos: UsuarioLancamento[];
}

export interface UsuarioLancamento {
  lancamentoId: string;
  descricao: string | null;
  duracaoTotal: number | null;
  dataLancamento: Date;
  horaInicio: Date;
  horaFim: Date;
  atividade: {
    atividadeId: string;
    nomeAtividade: string;
    projeto: { projetoId: string; nomeProjeto: string };
  };
}

export interface UserStats {
  totalHorasLancadas: string;
  totalLancamentos: number;
  totalProjetos: number;
  totalAtividades: number;
  horasPorProjeto: { projetoId: string; nomeProjeto: string; totalHoras: string }[];
}