import { AppError } from "@/lib/errors/AppError";
import type {
  GetLancamentosDTO,
  CreateLancamentoDTO,
  UpdateLancamentoDTO,
  UpdateLancamentoStatusDTO,
  LancamentoOutputList,
  GetNewInfoLancamentosDTO,
  LancamentoOutputById,
  LancamentosNewInfo,
} from "./lancamentos.dto";
import { Prisma } from "@prisma/client";
import {
  limitCheck,
  podeVerLancamentosDaEmpresa,
  recalcularHorasGastas,
} from "@/lib/utils";
import TimeStamps from "@/lib/TimeStamps";
import prisma from "@/prisma";

/**
 * Confere, dentro da transação, a origem do lançamento: a atividade existe, está ativa,
 * pertence ao projeto informado, o projeto pertence ao cliente informado e a atividade está
 * no escopo da empresa do ator (da própria empresa ou compartilhada por parceria ativa).
 */
const validarOrigemLancamento = async (
  tx: Prisma.TransactionClient,
  empresaId: string,
  atividadeId: string,
  projetoId: string,
  clienteId: string,
): Promise<void> => {
  const atividade = await tx.atividade.findFirst({
    where: {
      id: atividadeId,
      is_active: true,
      OR: [
        { empresa_id: empresaId },
        {
          compartilhado: true,
          projeto: {
            compartilhado: true,
            parceiro: {
              parceria: { empresa_parceira_id: empresaId, is_active: true },
            },
          },
        },
      ],
    },
    select: {
      projeto_id: true,
      projeto: { select: { parceiro_id: true } },
    },
  });

  if (!atividade) {
    throw new AppError(
      "Atividade não encontrada ou não pertence a esta empresa.",
      404,
    );
  }

  if (
    atividade.projeto_id !== projetoId ||
    atividade.projeto.parceiro_id !== clienteId
  ) {
    throw new AppError(
      "Projeto ou cliente não correspondem à atividade informada.",
      400,
    );
  }
};

const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Monta data e horários (UTC, `${data}T${hora}:00Z`) e calcula a duração em horas decimais.
 * Rejeita formato inválido e `hora_fim <= hora_inicio` (duração <= 0).
 */
const montarHorario = (
  dataLancamento: string,
  horaInicio: string,
  horaFim: string,
): {
  dataLancamentoLocal: Date;
  inicioDate: Date;
  fimDate: Date;
  duracaoHoras: number;
} => {
  if (
    typeof dataLancamento !== "string" ||
    typeof horaInicio !== "string" ||
    typeof horaFim !== "string" ||
    !HORA_REGEX.test(horaInicio) ||
    !HORA_REGEX.test(horaFim)
  ) {
    throw new AppError("Data ou horários inválidos.", 400);
  }

  const dataLancada = dataLancamento.split("T")[0];
  const dataLancamentoLocal = new Date(dataLancamento);
  const inicioDate = new Date(`${dataLancada}T${horaInicio}:00Z`);
  const fimDate = new Date(`${dataLancada}T${horaFim}:00Z`);

  if (
    isNaN(dataLancamentoLocal.getTime()) ||
    isNaN(inicioDate.getTime()) ||
    isNaN(fimDate.getTime())
  ) {
    throw new AppError("Data ou horários inválidos.", 400);
  }

  const duracaoHoras =
    (fimDate.getTime() - inicioDate.getTime()) / (1000 * 60 * 60);
  if (duracaoHoras <= 0) {
    throw new AppError(
      "O horário de fim deve ser maior que o horário de início.",
      400,
    );
  }

  return { dataLancamentoLocal, inicioDate, fimDate, duracaoHoras };
};

const empresaLancamentoWhere = (empresaId: string) => {
  return { 
    OR: [
      {atividade: { empresa_id: empresaId}},
      { atividade: {
        compartilhado: true,
        projeto: {
          compartilhado: true,
          parceiro: {
            parceria: {
              empresa_parceira_id: empresaId,
              is_active: true,
            }
          }
        }
      }}
    ]
  }
}

const find = async (
  dto: GetLancamentosDTO,
): Promise<
  { total: string; data: LancamentoOutputList[] } | LancamentoOutputById
> => {
  const {
    empresaId,
    from,
    limit,
    projetoId,
    ano,
    mes,
    lancamentoId,
    usuarioId,
    dataInicio,
    dataFim,
  } = dto;
  const verEmpresa = await podeVerLancamentosDaEmpresa(usuarioId, empresaId);

  if (lancamentoId) {
    return await findById(
      lancamentoId,
      empresaId,
      verEmpresa ? undefined : usuarioId,
    );
  }

  if (from === "all" && !verEmpresa) {
    throw new AppError(
      "Apenas gerentes ou administradores podem visualizar lançamentos de toda a equipe.",
      403,
    );
  }
  
  const where: Prisma.lancamentoWhereInput={};
  where.AND = [
    empresaLancamentoWhere(empresaId),
    { usuario_id: from === "all" ? undefined : usuarioId },
    projetoId ? { atividade: { projeto_id: projetoId } } : {},
  ];

  const anoFiltro = ano ? Number(ano) : new Date().getFullYear();
  let dataCompleta;

  if (dataInicio && dataFim) {
    const inicioLocal = new Date(`${dataInicio}T00:00:00Z`);
    const fimLocal = new Date(`${dataFim}T23:59:59Z`);
    dataCompleta = { from: inicioLocal, to: fimLocal };
  }
  // De hoje é 20 pois mês tava settado como number
  else if (mes === 20) {
    // Inicio do ano até hoje
    const inicioAno = new Date(Date.UTC(anoFiltro-1, 0, 1, 0, 0, 0, 0));
    const fimHoje = new TimeStamps().getDia();
    fimHoje.setUTCHours(23, 59, 59, 999);

    dataCompleta = { from: inicioAno, to: fimHoje };
  } else {
    dataCompleta = new TimeStamps().getRangeMonth(ano, mes);
  }

  where.data_lancamento = { gte: dataCompleta.from, lt: dataCompleta.to };

  const lancamentos = await prisma.lancamento.findMany({
    where,
    include: {
      usuario: {
        select: {
          id: true,
          nome_completo: true,
        },
      },
      atividade: {
        select: {
          id: true,
          nome_atividade: true,
          empresa_id: true,
          projeto: {
            select: {
              id: true,
              nome_projeto: true,
              parceiro: {
                select: {
                  nome_fantasia: true,
                  id: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: [{ data_lancamento: "desc" }, { hora_inicio: "desc" }],
    // take: Number(limit) || 20,
  });

  const total =
    (
      await prisma.lancamento.aggregate({
        _sum: { duracao_total: true },
        where,
      })
    )._sum.duracao_total || 0;

  const totalFormatado = new TimeStamps().getWatchHour(total);

  const mapped = lancamentos.map((item) => {
    const compartilhadoOutraEmpresa = item.atividade.empresa_id !== empresaId;

    return {
      lancamentoId: item.id,
      nomeAtividade: item.atividade?.nome_atividade,
      nomeProjeto: item.atividade?.projeto.nome_projeto,
      nomeFantasia: item.atividade.projeto.parceiro.nome_fantasia,
      dataLancamento: item.data_lancamento,
      duracaoTotal: item.duracao_total,
      horaInicio: item.hora_inicio,
      horaFim: item.hora_fim,
      nomeUsuario: item.usuario.nome_completo,
      compartilhado: compartilhadoOutraEmpresa
    }
  });
  return { total: totalFormatado, data: mapped };
};

/**
 * @param usuarioIdFiltro quando informado (COLAB), só encontra lançamentos desse usuário.
 */
const findById = async (
  id: string,
  empresaId: string,
  usuarioIdFiltro?: string,
): Promise<LancamentoOutputById> => {
  const empresaFilter = empresaLancamentoWhere(empresaId);

  const lancamento = await prisma.lancamento.findFirst({
    where: {
      id,
      usuario_id: usuarioIdFiltro,
      AND: [empresaFilter]
    },
    select: {
      id: true,
      data_lancamento: true,
      hora_inicio: true,
      hora_fim: true,
      descricao: true,
      duracao_total: true,
      tipo_lancamento: true,
      usuario: {
        select: {
          id: true,
          nome_completo: true,
          nome_usuario: true,
        },
      },
      atividade: {
        select: {
          id: true,
          nome_atividade: true,
          empresa_id: true,
          projeto: {
            select: {
              id: true,
              nome_projeto: true,
              parceiro: { select: { id: true, nome_fantasia: true } },
            },
          },
        },
      },
      despesas: {
        select: {
          id: true,
          nome_despesa: true,
        },
      },
    },
  });

  if (!lancamento) {
    throw new AppError(
      "Lançamento não encontrado ou não pertence a esta empresa.",
      404,
    );
  }

  const CompartilhadoOutraEmpresa = lancamento.atividade.empresa_id !== empresaId;

  return {
    descricao: lancamento.descricao as string,
    dataLancamento: lancamento.data_lancamento,
    horaInicio: lancamento.hora_inicio,
    projetoId: lancamento.atividade.projeto.id,
    atividadeId: lancamento.atividade.id,
    horaFim: lancamento.hora_fim,
    nomeProjeto: lancamento.atividade.projeto.nome_projeto,
    nomeUsuario: lancamento.usuario.nome_completo as string,
    usuarioId: lancamento.usuario.id,
    nomeFantasia: lancamento.atividade.projeto.parceiro.nome_fantasia,
    clienteId: lancamento.atividade.projeto.parceiro.id,
    nomeAtividade: lancamento.atividade.nome_atividade,
    duracao: lancamento.duracao_total as number,
    despesas: [],
    compartilhado: CompartilhadoOutraEmpresa,
  };
};

const getNewInfo = async (
  dto: GetNewInfoLancamentosDTO,
): Promise<LancamentosNewInfo> => {
  const [clientes, parceiros] = await Promise.all([
    prisma.parceiro.findMany({
      where: { empresa_id: dto.empresaId, is_active: true },
      select: {
        id: true,
        nome_fantasia: true,
        projetos: {
          where: { is_active: true },
          select: {
            id: true,
            nome_projeto: true,
            data_fim: true,
            horas_previstas: true,
            horas_gastas: true,
            atividades: {
              where: { is_active: true },
              select: {
                id: true,
                data_fim: true,
                horas_previstas: true,
                horas_gastas: true,
                nome_atividade: true,
                ref_cliente: true,
              },
            },
          },
        },
      },
    }),
    prisma.parceria.findMany({
      where: { empresa_parceira_id: dto.empresaId, is_active: true },
      select: {
        parceiro: {
          select: {
            id: true,
            nome_fantasia: true,
            projetos: {
              where: { is_active: true, compartilhado: true },
              select: {
                id: true,
                nome_projeto: true,
                data_fim: true,
                horas_previstas: true,
                horas_gastas: true,
                atividades: {
                  where: { is_active: true, compartilhado: true },
                  select: {
                    id: true,
                    data_fim: true,
                    horas_previstas: true,
                    horas_gastas: true,
                    nome_atividade: true,
                    ref_cliente: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  const retClientes = clientes.map((c) => ({
    id: c.id,
    nome: c.nome_fantasia,
  }))

  const retProjetos = clientes.flatMap((c) =>
    c.projetos.map((p) => ({
      id: p.id,
      nome: p.nome_projeto,
      clienteId: c.id,
      limiteAtingido: limitCheck(p),
    }))
  );

  const retAtividades = clientes.flatMap((c) =>
    c.projetos.flatMap((p) =>
      p.atividades.map((a) => ({
        id: a.id,
        nome: a.nome_atividade,
        projetoId: p.id,
        limiteAtingido: limitCheck(a),
        refCliente: a.ref_cliente || "",
      })),
    ),
  )

  const parceiroClientes = parceiros.map((par) => ({
    id: par.parceiro.id,
    nome: par.parceiro.nome_fantasia,
    compartilhado: true,
  }))

  const parceiroProjetos = parceiros.flatMap((par) =>
    par.parceiro.projetos.map((p) => ({
      id: p.id,
      nome: p.nome_projeto,
      clienteId: par.parceiro.id,
      limiteAtingido: limitCheck(p),
      compartilhado: true,
    })),
  )

  const parceiroAtividades = parceiros.flatMap((par) =>
    par.parceiro.projetos.flatMap((p) =>
      p.atividades.map((a) => ({
        id: a.id,
        nome: a.nome_atividade,
        projetoId: p.id,
        limiteAtingido: limitCheck(a),
        compartilhado: true,
        refCliente: a.ref_cliente || "",
      })),
    ),
  )
  
  const mergedClientes = [...retClientes, ...parceiroClientes].sort((a, b) => a.nome.localeCompare(b.nome));
  const mergedProjetos = [...retProjetos, ...parceiroProjetos].sort((a, b) => a.nome.localeCompare(b.nome));
  const mergedAtividades = [...retAtividades, ...parceiroAtividades].sort((a, b) => a.nome.localeCompare(b.nome));
  return {
    clientes: mergedClientes,
    projetos: mergedProjetos,
    atividades: mergedAtividades,
  };
};

const create = async (dto: CreateLancamentoDTO): Promise<void> => {
  const {
    empresaId,
    atividadeId,
    projetoId,
    clienteId,
    userId,
    dataLancamento,
    horaFim,
    horaInicio,
    descricao,
  } = dto;

  if (!atividadeId || !projetoId || !clienteId) {
    throw new AppError("Atividade, projeto e cliente são obrigatórios.", 400);
  }

  const { dataLancamentoLocal, inicioDate, fimDate, duracaoHoras } =
    montarHorario(dataLancamento, horaInicio, horaFim);

  // Validação de Data Futura
  const hoje = new TimeStamps().getDia();
  if (dataLancamentoLocal > hoje) {
    throw new AppError("Não é permitido lançar horas em datas futuras", 400);
  }

  // Range de data para buscar um lancamento conflitante
  const { from, to } = new TimeStamps().getRangeDate(dataLancamentoLocal);

  // Origem + conflito + gravação + horas gastas na mesma transação (curta, sem I/O externo)
  await prisma.$transaction(async (tx) => {
    await validarOrigemLancamento(
      tx,
      empresaId,
      atividadeId,
      projetoId,
      clienteId,
    );

    const lancamentoConflito = await tx.lancamento.findFirst({
      where: {
        // atividade: { empresa_id: empresaId },
        // por usuario por empresa
        // ou por usuario so ??
        usuario_id: userId,
        data_lancamento: {
          gte: from,
          lt: to,
        },
        hora_inicio: { lt: fimDate },
        hora_fim: { gt: inicioDate },
      },
      select: { id: true },
    });

    if (lancamentoConflito) {
      throw new AppError(
        `Já existe um lançamento registrado entre ${horaInicio} e ${horaFim}`,
        400,
      );
    }

    await tx.lancamento.create({
      data: {
        atividade_id: atividadeId,
        projeto_id: projetoId,
        cliente_id: clienteId,
        usuario_id: userId,
        descricao,
        data_lancamento: dataLancamentoLocal,
        hora_inicio: inicioDate,
        hora_fim: fimDate,
        duracao_total: duracaoHoras,
      },
    });

    await recalcularHorasGastas(atividadeId, projetoId, duracaoHoras, tx);
  });
};

const update = async (dto: UpdateLancamentoDTO): Promise<void> => {
  const {
    id,
    empresaId,
    usuarioId,
    dataLancamento,
    horaInicio,
    horaFim,
    descricao,
    motivoEdicao,
    atividadeId,
    projetoId,
    clienteId,
  } = dto;

  if (!atividadeId || !projetoId || !clienteId) {
    throw new AppError("Atividade, projeto e cliente são obrigatórios.", 400);
  }

  const { dataLancamentoLocal, inicioDate, fimDate, duracaoHoras } =
    montarHorario(dataLancamento, horaInicio, horaFim);

  // Validação de Data Futura (mesma regra do create)
  if (dataLancamentoLocal > new TimeStamps().getDia()) {
    throw new AppError("Não é permitido lançar horas em datas futuras", 400);
  }

  const verEmpresa = await podeVerLancamentosDaEmpresa(usuarioId, empresaId);

  // Range de data para buscar um lancamento conflitante
  const { from, to } = new TimeStamps().getRangeDate(dataLancamentoLocal);

  let descricaoFinal = descricao || "";
  if (motivoEdicao && motivoEdicao.trim() !== "") {
    descricaoFinal = `${descricaoFinal} | [Motivo Edição: ${motivoEdicao}]`;
  }

  const empresaFilter = empresaLancamentoWhere(empresaId);

  // Leitura + conflito + gravação + horas gastas na mesma transação (curta, sem I/O externo)
  await prisma.$transaction(async (tx) => {
    // Lançamento de um projeto da empresa; COLAB só encontra os próprios
    const lancamentoAtual = await tx.lancamento.findFirst({
      where: {
        id,
        usuario_id: verEmpresa ? undefined : usuarioId,
        AND: [empresaFilter],
      },
      select: {
        usuario_id: true,
        duracao_total: true,
        atividade_id: true,
        projeto_id: true,
      },
    });

    if (!lancamentoAtual) {
      throw new AppError(
        "Lançamento não encontrado ou não pertence a esta empresa.",
        404,
      );
    }

    await validarOrigemLancamento(
      tx,
      empresaId,
      atividadeId,
      projetoId,
      clienteId,
    );

    const conflito = await tx.lancamento.findFirst({
      where: {
        NOT: { id },
        usuario_id: lancamentoAtual.usuario_id,
        data_lancamento: {
          gte: from,
          lt: to,
        },
        hora_inicio: { lt: fimDate },
        hora_fim: { gt: inicioDate },
      },
      select: { id: true },
    });

    if (conflito) {
      throw new AppError(
        "Você já possui um lançamento neste espaço de tempo",
        400,
      );
    }

    await tx.lancamento.update({
      where: { id },
      data: {
        data_lancamento: dataLancamentoLocal,
        hora_inicio: inicioDate,
        hora_fim: fimDate,
        duracao_total: duracaoHoras,
        descricao: descricaoFinal,
        atividade_id: atividadeId,
        projeto_id: projetoId,
        cliente_id: clienteId,
      },
    });

    const mudancaHoras =
      duracaoHoras - (lancamentoAtual.duracao_total as number);

    // Se a atividade ou projeto mudou na edição ele remove do antigo e insere no novo
    if (
      lancamentoAtual.atividade_id !== atividadeId ||
      lancamentoAtual.projeto_id !== projetoId
    ) {
      await recalcularHorasGastas(
        lancamentoAtual.atividade_id,
        lancamentoAtual.projeto_id,
        -(lancamentoAtual.duracao_total as number),
        tx,
      );
      await recalcularHorasGastas(atividadeId, projetoId, duracaoHoras, tx);
    } else {
      await recalcularHorasGastas(atividadeId, projetoId, mudancaHoras, tx);
    }
  });
};

const remove = async (
  id: string,
  empresaId: string,
  usuarioId: string,
): Promise<void> => {
  const verEmpresa = await podeVerLancamentosDaEmpresa(usuarioId, empresaId);
  const empresaFilter = empresaLancamentoWhere(empresaId);

  await prisma.$transaction(async (tx) => {
    // Lançamento de um projeto da empresa; COLAB só encontra os próprios
    const lancamento = await tx.lancamento.findFirst({
      where: {
        id,
        usuario_id: verEmpresa ? undefined : usuarioId,
        AND: [empresaFilter],
      },
      select: {
        id: true,
        duracao_total: true,
        atividade_id: true,
        projeto_id: true,
      },
    });

    if (!lancamento) {
      throw new AppError(
        "Lançamento não encontrado ou não pertence a esta empresa.",
        404,
      );
    }

    if (!lancamento.atividade_id || !lancamento.projeto_id) {
      throw new AppError("Atividade ou projeto não podem ser nulos", 400);
    }

    await tx.lancamento.delete({ where: { id } });

    if (lancamento.duracao_total) {
      await recalcularHorasGastas(
        lancamento.atividade_id,
        lancamento.projeto_id,
        -lancamento.duracao_total, // Valor negativo pra subtrair das horas_gastas
        tx,
      );
    }
  });
};

const updateStatus = async (dto: UpdateLancamentoStatusDTO): Promise<void> => {
  const { id, empresaId, status, cargo } = dto;

  if (cargo !== "gerente") {
    throw new AppError("Apenas gerentes podem aprovar horas", 403);
  }

  const empresaFilter = empresaLancamentoWhere(empresaId);

  // Validar que o lançamento pertence a um projeto da empresa
  const lancamento = await prisma.lancamento.findFirst({
    where: {
      id,
      AND: [empresaFilter],
    },
  });

  if (!lancamento) {
    throw new AppError(
      "Lançamento não encontrado ou não pertence a esta empresa.",
      404,
    );
  }
};

export const LancamentosService = {
  find,
  getNewInfo,
  create,
  update,
  remove,
  updateStatus,
};
