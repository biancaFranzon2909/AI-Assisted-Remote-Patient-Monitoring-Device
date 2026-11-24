// ─── Input DTOs ───────────────────────────────────────────────────────────────

export interface RelatorioQueryDTO {
  tipo?: string;
  filext?: "xlsx" | "pdf";
}

export type RelatorioFilters = Record<string, { inicio?: string; fim?: string } | undefined>;

// ─── Output DTOs ──────────────────────────────────────────────────────────────

export interface RelatorioResult {
  error: boolean;
  data: any;
}

export interface RelatorioBufferResult {
  buffer: import("exceljs").Buffer;
  fileName: string;
  contentType: string;
}


export interface RelatorioJsonResult {
  error: boolean;
  data: RegistroJson[];
}

export interface RegistroJson {
  empresa: {
    nome: string,
    identificador: string
  },
  cliente: string,
  projeto: string,
  atividade: string,
  data: string,
  qtd_horas_decimal: number,
  descricao: string,
  colaborador: string,
  horaInicio: Date;
  horaFim: Date;
}

export interface RelatorioRegistroQueryDTO {
  identificador?: string;
  dataInicio?: string;
  dataFim?: string;
  clienteInicio?: string;
  clienteFim?: string;
  projetoInicio?: string;
  projetoFim?: string;
  colaboradorInicio?: string;
  colaboradorFim?: string;
  atividadeInicio?: string;
  atividadeFim?: string;
  tipoAtividadeInicio?: string;
  tipoAtividadeFim?: string;
  
}