import { AppError } from "@/lib/errors/AppError";
import type {
  CreateAtividadeDTO,
  UpdateAtividadeDTO,
  GetAtividadesDTO,
  DeleteAtividadeDTO,
  AtividadeDetail,
  AtividadesList,
} from "./atividades.dto";
import { limitCheck, podeVerLancamentosDaEmpresa } from "@/lib/utils";
import prisma from "@/prisma";

const create = async (dto: CreateAtividadeDTO): Promise<void> => {
  const {
    empresaId,
    refCliente,
    nomeAtividade,
    descrAtividade,
    dataPrevistaInicio,
    dataPrevistaFim,
    horasPrevistas,
    prioridade,
    tipoAtividade,
    projetoId,
    centroCusto,
    solicitante,
  } = dto;

  // Validar que o projeto pertence à empresa
  const projeto = await prisma.projeto.findUnique({
    where: { id: projetoId, empresa_id: empresaId },
    select: { 
      horas_previstas: true,
      centro_custo: true,
      solicitante: true, 
    },
  });

  if (!projeto) {
    throw new AppError(
      "Projeto não encontrado ou não pertence a esta empresa.",
      404,
    );
  }
  // Validar se tem do projeto centro de custo e solicitante
  const finalCentroCusto = projeto.centro_custo || centroCusto;
  const finalSolicitante = projeto.solicitante || solicitante;

  // Validar se o projeto tem limite de horas e se a nova atividade excede esse limite
  // ------------------- É AQUI -------------------------
  // lUCAS, vamos tirar aqui a mecânica de incrementar nas horas gastas as horas previstas da atividade?
  // fica meio ruim pq literalmente dobra as horas, mas se quiser manter podemos deixar
  // Faria sentido tirar pq as horas gastas são as horas efetivamente gastas, não as previstas + as gastas
  // if (
  //   horasPrevistas &&
  //   !Number.isNaN(horasPrevistas) &&
  //   projeto.horas_previstas
  // ) {
  //   await prisma.projeto.update({
  //     where: { id: projetoId },
  //     data: { 
  //       horas_gastas: {
  //         increment: horasPrevistas
  //       }
  //     },
  //   });
  // }

  await prisma.atividade.create({
    data: {
      nome_atividade: nomeAtividade,
      descr_atividade: descrAtividade,
      data_inicio: new Date(dataPrevistaInicio),
      data_fim: new Date(dataPrevistaFim),
      horas_previstas: horasPrevistas ? Number(horasPrevistas) : undefined,
      projeto_id: projetoId,
      empresa_id: empresaId,
      prioridade,
      tipo: tipoAtividade,
      ref_cliente: refCliente,
      centro_custo: finalCentroCusto,
      solicitante: finalSolicitante,
    },
  });
};

const update = async (dto: UpdateAtividadeDTO): Promise<void> => {
  const {
    id,
    empresaId,
    nomeAtividade,
    // prioridade,
    descrAtividade,
    dataPrevistaInicio,
    dataPrevistaFim,
    horasPrevistas,
    tipoAtividade,
    refCliente,
    // status,
    centroCusto,
    solicitante,
    isActive,
  } = dto;

  // Validar que o projeto pertence à empresa nao sei se e necessario
  const projeto = (
    await prisma.atividade.findUnique({
      where: { id, empresa_id: empresaId },
      select: { projeto: true },
    })
  )?.projeto;

  if (!projeto) {
    throw new AppError(
      "Projeto não encontrado ou não pertence a esta empresa.",
      404,
    );
  }

  const atividadeAtual = await prisma.atividade.findUnique({
    where: { id, empresa_id: empresaId },
    select: { 
      projeto: {
        select: {
          id: true,
          centro_custo: true,
          solicitante: true,
        }
      } 
    },
  });

  const finalCentroCusto = atividadeAtual?.projeto.centro_custo || centroCusto;
  const finalSolicitante = atividadeAtual?.projeto.solicitante || solicitante;

 // Caso tenha o is_active ele desativa
  if (typeof isActive !== "undefined" && !nomeAtividade) {
    await prisma.atividade.update({
      where: { id, empresa_id: empresaId},
      data: { is_active: isActive}
    })
    return;
  } 

// ------------------- É AQUI -------------------------
  // Daí tirariamos daqui tbm 
  // const horasPrevistasAtual = (await prisma.atividade.findFirst({
  //   where: {
  //     id,
  //   },
  // }))?.horas_previstas ?? 0

  // const novasHorasGastas = (projeto.horas_gastas - horasPrevistasAtual) + (horasPrevistas ?? 0);
  
  await prisma.atividade.update({
    where: { id },
    data: {
      nome_atividade: nomeAtividade,
      descr_atividade: descrAtividade,
      tipo: tipoAtividade,
      data_inicio: dataPrevistaInicio ? new Date(dataPrevistaInicio) : undefined,
      data_fim: dataPrevistaFim ? new Date(dataPrevistaFim) : undefined,
      horas_previstas: Number(horasPrevistas),
      ref_cliente: refCliente,
      centro_custo: finalCentroCusto,
      solicitante: finalSolicitante,

    },
  });
  // ------------------- É AQUI -------------------------
  //Aqui onde ele manda as novas horas gastas, fazendo que edições de atividades fossem aumentando as horas gastas
  // Sendo que hora nenhuma gasta foi lançada
  // await prisma.projeto.update({
  //   where: { id: projeto.id },
  //   data: { horas_gastas: novasHorasGastas },
  // });
};

const remove = async (dto: DeleteAtividadeDTO): Promise<void> => {
  const { id, empresaId } = dto;

  // Validar que a atividade pertence a um projeto da empresa
  const atividade = await prisma.atividade.findFirst({
    where: {
      id,
      projeto: { empresa_id: empresaId },
    },
  });

  if (!atividade) {
    throw new AppError(
      "Atividade não existe ou não pertence a esta empresa.",
      404,
    );
  }

  try {
    await prisma.atividade.delete({ where: { id } });
  } catch {
    throw new AppError(
      "Atividades com horas lançadas não podem ser excluídas.",
      400,
    );
  }
};

const find = async (
  dto: GetAtividadesDTO,
): Promise<AtividadesList[] | AtividadeDetail> => {
  const { empresaId, atividadeId, usuarioId } = dto;
  
  if (atividadeId) return await findById(atividadeId, empresaId, usuarioId);

  const where: any = {
    empresa_id: empresaId,
  };

  const atividades = await prisma.atividade.findMany({
    where,
    select: {
      id: true,
      projeto_id: true,
      nome_atividade: true,
      prioridade: true,
      data_inicio: true,
      data_fim: true,
      horas_gastas: true,
      horas_previstas: true,
      ref_cliente: true,
      is_active: true,
      projeto: {
        select: {
          nome_projeto: true,
          parceiro: { select: { nome_fantasia: true } },
        },
      },
      centro_custo: true,
      solicitante: true,
      // compartilhado: true,
    },
    orderBy: { nome_atividade: "asc" },
  });

  const parceriaCompartilhados = await prisma.parceria.findMany({
    where: { empresa_parceira_id: dto.empresaId, is_active: true},
    select: {
      parceiro: {
        select: {
          projetos: {
            select: {
              atividades: {
                where: { is_active: true, compartilhado: true},
                select: {
                  id: true,
                  projeto_id: true,
                  nome_atividade: true,
                  prioridade: true,
                  data_inicio: true,
                  data_fim: true,
                  horas_gastas: true,
                  horas_previstas: true,
                  ref_cliente: true,
                  is_active: true,
                  projeto: {
                    select: {
                      nome_projeto: true,
                      parceiro: { select: { nome_fantasia: true } },
                    },
                  },
                  centro_custo: true,
                  solicitante: true,
                  compartilhado: true,
                },
                orderBy: { nome_atividade: "asc"},
              }
            }
          }
        }
      }
    },
  })

  const todasAtividades: AtividadesList[] = [
    ...atividades.map((atv) => ({
    atividadeId: atv.id,
    nomeProjeto: atv.projeto.nome_projeto,
    nomeFantasia: atv.projeto.parceiro.nome_fantasia,
    nomeAtividade: atv.nome_atividade,
    previsaoInicio: atv.data_inicio,
    previsaoFim: atv.data_fim,
    horasPrevistas: atv.horas_previstas,
    horasGastas: atv.horas_gastas,
    refCliente: atv.ref_cliente,
    prioridade: atv.prioridade,
    centroCusto: atv.centro_custo,
    solicitante: atv.solicitante,
    isActive: atv.is_active,
    })),
    ...parceriaCompartilhados.flatMap((parceria) =>
      (parceria.parceiro?.projetos || []).flatMap((proj) =>
        (proj.atividades || []).map((a) => ({
          atividadeId: a.id,
          nomeProjeto: a.projeto.nome_projeto,
          nomeFantasia: a.projeto.parceiro.nome_fantasia,
          nomeAtividade: a.nome_atividade,
          previsaoInicio: a.data_inicio,
          previsaoFim: a.data_fim,
          horasPrevistas: a.horas_previstas,
          horasGastas: a.horas_gastas,
          refCliente: a.ref_cliente,
          prioridade: a.prioridade,
          centroCusto: a.centro_custo,
          solicitante: a.solicitante,
          isActive: a.is_active,
          compartilhado: a.compartilhado,
        })),
      ),
    ),
  ];
  
  return todasAtividades.sort((a, b) => a.nomeAtividade.localeCompare(b.nomeAtividade));
};

/**
 * @param usuarioId ator: OWNER/ADMIN veem os últimos lançamentos de todos na atividade; COLAB, só os próprios.
 */
const findById = async (
  id: string,
  empresaId: string,
  usuarioId: string,
): Promise<AtividadeDetail> => {
  const verEmpresa = await podeVerLancamentosDaEmpresa(usuarioId, empresaId);

  const atividade = await prisma.atividade.findFirst({
    where: {
      id,
      // Da empresa do ator, ou compartilhada por parceria ativa (mesmo predicado de validarOrigemLancamento)
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
      nome_atividade: true,
      descr_atividade: true,
      empresa_id: true,
      lancamentos_de_horas: {
        // OWNER/ADMIN: lançamentos de usuários da própria empresa; COLAB: só os próprios
        where: verEmpresa
          ? { usuario: { empresas: { some: { empresa_id: empresaId } } } }
          : { usuario_id: usuarioId },
        orderBy: { data_lancamento: "desc" },
        take: 5,
        select: {
          id: true,
          usuario_id: true,
          data_lancamento: true,
          hora_inicio: true,
          hora_fim: true,
          duracao_total: true,
          descricao: true,
          tipo_lancamento: true,
        },
      },
      prioridade: true,
      data_inicio: true,
      data_fim: true,
      tipo: true,
      ref_cliente: true,
      horas_previstas: true,
      horas_gastas: true,
      is_active: true,
      projeto: {
        select: {
          nome_projeto: true,
          id: true,
          status: true,
          centro_custo: true,
          solicitante: true,
          parceiro: { select: { nome_fantasia: true, id: true } },
        },
      },
      centro_custo: true,
      solicitante: true,
    },
  });

  if (!atividade) {
    throw new AppError(
      "Atividade não encontrada ou não pertence a esta empresa.",
      404,
    );
  }

  const compartilhado = atividade.empresa_id !== empresaId;

  return {
    clienteId: atividade.projeto.parceiro.id,
    nomeAtividade: atividade.nome_atividade,
    descrAtividade: atividade.descr_atividade,
    lancamentos: atividade.lancamentos_de_horas,
    prioridade: atividade.prioridade,
    previsaoInicio: atividade.data_inicio,
    previsaoFim: atividade.data_fim,
    horasPrevistas: atividade.horas_previstas || "Em Aberto",
    horasGastas: atividade.horas_gastas,
    tipoAtividade: atividade.tipo,
    refCliente: atividade.ref_cliente,
    limiteExcedido: limitCheck(atividade),
    projeto: {
      projetoId: atividade.projeto.id,
      status: atividade.projeto.status,
      nomeProjeto: atividade.projeto.nome_projeto,
      centroCusto: atividade.projeto.centro_custo,
      solicitante: atividade.projeto.solicitante,
      cliente: {
        clienteId: atividade.projeto.parceiro.id,
        nomeFantasia: atividade.projeto.parceiro.nome_fantasia || "",
      },
    },
    centroCusto: atividade.centro_custo,
    solicitante: atividade.solicitante,
    isActive: atividade.is_active,
    compartilhado,
  };
};

export const AtividadesService = {
  create,
  update,
  remove,
  find,
};
