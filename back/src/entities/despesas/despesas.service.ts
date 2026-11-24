import TimeStamps from "@/lib/TimeStamps";
import { AppError } from "@/lib/errors/AppError";
import type {
  BuscarLancamentosPorDataDTO,
  CreateDespesaDTO,
  UpdateDespesaDTO,
  GetDespesasDTO,
  DeleteDespesaDTO,
  DespesaComLancamento,
  LancamentoPorDataOutput,
} from "./despesas.dto";
import prisma from "@/prisma";
import { podeVerLancamentosDaEmpresa } from "@/lib/utils";

const buscarLancamentosPorData = async (dto: BuscarLancamentosPorDataDTO): Promise<LancamentoPorDataOutput[]> => {
  const { empresaId, colaboradorId, data } = dto
  const rangeData = new TimeStamps().getRangeDate(new Date(data))

  const lancamentos = await prisma.lancamento.findMany({
    where: {
      usuario_id: colaboradorId,
      atividade: {
        empresa_id: empresaId,
      },
      data_lancamento: {
        gte: rangeData.from,
        lte: rangeData.to,
      },
    },
    include: {
      atividade: {
        include: {
          projeto: {
            include: {
              parceiro: true,
            },
          },
        },
      },
    },
  })

  return lancamentos.map((l) => ({
    id: l.id,
    horaInicio: l.hora_inicio,
    horaFim: l.hora_fim,
    cliente: l.atividade.projeto.parceiro.nome_fantasia,
    projeto: l.atividade.projeto.nome_projeto,
    atividade: l.atividade.nome_atividade,
  }))
}

const create = async (dto: CreateDespesaDTO): Promise<void> => {
  const { empresaId, nomeDespesa, descricao, valor, dataDespesa, colaboradorId, lancamentoId } = dto;

  if (isNaN(valor) || valor <= 0) {
    throw new AppError("Valor inválido.", 400);
  }

  if (lancamentoId) {
    // Lançamento da empresa do ator; COLAB só encontra os próprios
    const verEmpresa = await podeVerLancamentosDaEmpresa(colaboradorId, empresaId);
    const lancamento = await prisma.lancamento.findFirst({
      where: {
        id: lancamentoId,
        usuario_id: verEmpresa ? undefined : colaboradorId,
        atividade: { empresa_id: empresaId },
      },
      select: { id: true },
    });

    if (!lancamento) {
      throw new AppError(
        "Lançamento não encontrado ou não pertence a esta empresa.",
        404,
      );
    }

    await prisma.despesa.create({
      data: {
        nome_despesa: nomeDespesa,
        valor,
        descricao,
        lancamento_id: lancamento.id,
      }
    });
    return;
  }

  // Só precisa saber se há 0, 1 ou mais lançamentos do ator na data
  const lancamentoNaData = await prisma.lancamento.findMany({
    where: {
      usuario_id: colaboradorId,
      atividade: {
        empresa_id: empresaId,
      },
      data_lancamento: new Date(dataDespesa)
    },
    select: { id: true },
    take: 2,
  });

  if (lancamentoNaData.length === 0) {
    throw new AppError(
      "É necessário ter um lançamento de horas nessa data para criar uma despesa.",
      400,
    );
  }

  if (lancamentoNaData.length > 1) {
    throw new AppError(
      "Há mais de um lançamento nessa data: informe o lançamento da despesa.",
      400,
    );
  }

  await prisma.despesa.create({
    data: {
      nome_despesa: nomeDespesa,
      valor,
      descricao,
      lancamento_id: lancamentoNaData[0].id,
    },
  });
};

const findMany = async (
  dto: GetDespesasDTO,
): Promise<DespesaComLancamento[]> => {
  const { empresaId ,colaboradorId, dataInicio, dataFim } = dto;

  let filtroData = {};

  if (dataInicio && dataFim) {
    const data_from = new TimeStamps().getRangeDate(
      new Date(dataInicio),
    ).from;
    const data_to = new TimeStamps().getRangeDate(new Date(dataFim)).to;

    filtroData = {
      data_lancamento: {
        gte: data_from,
        lte: data_to,
      },
    };
  }

  const despesas = await prisma.despesa.findMany({
    orderBy: { criado_em: "desc" },
    where: {
      lancamento: {
        ...filtroData,
        usuario_id: colaboradorId,
        atividade: {
          empresa_id: empresaId,
        }
      },
    },
    include: {
      lancamento: {
        include: {
          atividade: {
            include: {
              projeto: {
                include: {
                  parceiro: true,
                }
              }
            }
          },
        },
      },
    },
  });

  return despesas.map((despesa) => ({
    despesaId: despesa.id,
    nomeDespesa: despesa.nome_despesa,
    descricao: despesa.descricao,
    dataDespesa: despesa.lancamento.data_lancamento,
    valor: despesa.valor,
    nomeFantasia: despesa.lancamento.atividade.projeto.parceiro.nome_fantasia,
  }))

  // return despesas as unknown as DespesaComLancamento[];
};

const remove = async (dto: DeleteDespesaDTO): Promise<void> => {
  const { id, empresaId, usuarioId } = dto;

  // Despesa de lançamento da empresa do ator; COLAB só apaga as dos próprios lançamentos
  const verEmpresa = await podeVerLancamentosDaEmpresa(usuarioId, empresaId);

  const { count } = await prisma.despesa.deleteMany({
    where: {
      id,
      lancamento: {
        usuario_id: verEmpresa ? undefined : usuarioId,
        atividade: { empresa_id: empresaId },
      },
    },
  });

  if (count === 0) {
    throw new AppError("Despesa não encontrada.", 404);
  }
};

export const DespesasService = { create, findMany, remove, buscarLancamentosPorData };