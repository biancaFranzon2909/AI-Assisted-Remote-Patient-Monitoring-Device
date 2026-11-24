import { Prisma } from "@prisma/client";
import { AppError } from "@/lib/errors/AppError";
import type {
  CreateProjetoDTO,
  UpdateProjetoDTO,
  DeleteProjetoDTO,
  GetProjetosDTO,
  ProjetoDetail,
  ProjetoList,
  ProjetoBase,
} from "./projetos.dto";
import { projetoBaseSelect } from "./projetos.dto";
import { limitCheck } from "@/lib/utils";
import prisma from "@/prisma";

const collator = new Intl.Collator("pt-BR");
// util para o Find ----
const toProjetoListBase = (p: ProjetoBase) => ({
  projetoId: p.id,
  nomeProjeto: p.nome_projeto,
  horasGastas: p.horas_gastas ?? 0,
  horasPrevistas: p.horas_previstas ?? 0,
  refCliente: p.ref_cliente ?? "",
  limiteAtingido: limitCheck(p),
  dataInicio: p.data_inicio ?? new Date(),
  dataFim: p.data_fim ?? new Date(),
  status: p.status,
  atividades: p._count.atividades,
  centroCusto: p.centro_custo,
  solicitante: p.solicitante,
  tipoProjeto: p.tipo,
  isActive: p.is_active,
});
// ----------

// -------------- CRUD --------------
const find = async (
  dto: GetProjetosDTO,
): Promise<ProjetoList[] | ProjetoDetail> => {
  if (dto.projetoId) {
    return findById(dto.projetoId, dto.empresaId);
  }

  // As duas queries são independentes: rodam em paralelo
  const [projetosEmpresa, parcerias] = await Promise.all([
    prisma.projeto.findMany({
      where: { empresa_id: dto.empresaId },
      select: {
        ...projetoBaseSelect,
        parceiro: { select: { id: true, nome_fantasia: true } },
      },
    }),
    prisma.parceria.findMany({
      where: { empresa_parceira_id: dto.empresaId, is_active: true },
      select: {
        empresa_id: true,
        parceiro: {
          select: {
            projetos: {
              where: { is_active: true, compartilhado: true },
              select: { ...projetoBaseSelect, compartilhado: true },
            },
          },
        },
      },
    }),
  ]);

  const empresasIds = [...new Set(parcerias.map((p) => p.empresa_id))];

  const parceriasNomes = empresasIds.length
    ? await prisma.parceria.findMany({
        where: {
          empresa_id: dto.empresaId,
          empresa_parceira_id: { in: empresasIds },
        },
        select: {
          empresa_parceira_id: true,
          parceiro: { select: { nome_fantasia: true } },
        },
      })
    : [];

  const nomesParceiros = new Map(
    parceriasNomes.map((p) => [
      p.empresa_parceira_id,
      p.parceiro.nome_fantasia,
    ]),
  );

  const proprios: ProjetoList[] = projetosEmpresa.map((p) => ({
    ...toProjetoListBase(p),
    nomeFantasia: p.parceiro.nome_fantasia ?? "",
    parceiroId: p.parceiro.id,
  }));

  const compartilhados: ProjetoList[] = parcerias.flatMap((parceria) =>
    (parceria.parceiro?.projetos ?? []).map((p) => ({
      ...toProjetoListBase(p),
      nomeFantasia: nomesParceiros.get(parceria.empresa_id) ?? "",
      compartilhado: p.compartilhado,
    })),
  );

  return [...proprios, ...compartilhados].sort((a, b) =>
    collator.compare(a.nomeProjeto, b.nomeProjeto),
  );
};

const findById = async (
  id: string,
  empresaId: string,
): Promise<ProjetoDetail> => {
  // Da empresa do ator, ou compartilhado por parceria ativa (mesmo predicado de validarOrigemLancamento)
  const projeto = await prisma.projeto.findUnique({
    where: {
      id,
      OR: [
        { empresa_id: empresaId },
        {
          compartilhado: true,
          parceiro: {
            parceria: { empresa_parceira_id: empresaId, is_active: true },
          },
        },
      ],
    },
    include: {
      parceiro: { select: { nome_fantasia: true } },
      atividades: {
        // Parceira só vê as atividades compartilhadas
        where: {
          OR: [{ empresa_id: empresaId }, { compartilhado: true }],
        },
        select: {
          id: true,
          empresa_id: true,
          prioridade: true,
          ref_cliente: true,
          nome_atividade: true,
          compartilhado: true,
          tipo: true,
          centro_custo: true,
          solicitante: true,
          data_inicio: true,
          data_fim: true,
        },
        orderBy: { id: "asc" },
      },
      equipe: {
        orderBy: { nome_usuario: "asc" },
        select: { id: true, nome_usuario: true, nome_completo: true },
      },
    },
  });

  if (!projeto) {
    throw new AppError("Projeto não encontrado.", 404);
  }

  const compartilhado = projeto.empresa_id !== empresaId;

  return {
    projetoId: projeto.id,
    nomeProjeto: projeto.nome_projeto,
    refClienteProjeto: projeto.ref_cliente,
    descricao: projeto.descricao,
    dataInicio: projeto.data_inicio,
    dataFim: projeto.data_fim,
    compartilharComCliente: projeto.compartilhado,
    horasGastas: projeto.horas_gastas,
    horasPrevistas: projeto.horas_previstas || "Em Aberto",
    nomeFantasia: projeto.parceiro.nome_fantasia,
    clienteId: projeto.parceiro_id,
    atividades: projeto.atividades.map((at) => ({
      atividadeId: at.id,
      nomeAtividade: at.nome_atividade,
      prioridade: at.prioridade,
      refClienteAtividade: at.ref_cliente,
      compartilhado: at.compartilhado,
      tipo: at.tipo,
      centroCusto: at.centro_custo,
      solicitante: at.solicitante,
      dataInicio: at.data_inicio,
      dataFim: at.data_fim,
    })),
    // Equipe é dado interno da empresa dona: a parceira recebe lista vazia
    equipe: compartilhado
      ? []
      : projeto.equipe.map((usr) => ({
          usuarioId: usr.id,
          nomeUsuario: usr.nome_usuario,
          nomeCompleto: usr.nome_completo,
        })),
    status: projeto.status,
    centroCusto: projeto.centro_custo,
    solicitante: projeto.solicitante,
    tipoProjeto: projeto.tipo,
    isActive: projeto.is_active,
    compartilhado,
  };
};

const create = async (dto: CreateProjetoDTO): Promise<void> => {
  const {
    empresaId,
    clienteId,
    nomeProjeto,
    descricao,
    refCliente,
    dataInicio,
    dataFim,
    status,
    horasPrevistas,
    equipe,
    centroCusto,
    solicitante,
    tipoProjeto,
  } = dto;

  const inicio = new Date(dataInicio);
  const fim = new Date(dataFim);

  if (fim < inicio) {
    throw new AppError("Data Fim não pode ser anterior à Data Início.", 400);
  }

  if (!clienteId) {
    throw new AppError("Cliente é obrigatório para criar um projeto.", 400);
  }

  // Validar que o cliente pertence à empresa
  const clienteValido = await prisma.parceiro.findUnique({
    where: { id: clienteId, empresa_id: empresaId },
  });

  if (!clienteValido) {
    throw new AppError(
      "Cliente não encontrado ou não pertence a esta empresa.",
      404,
    );
  }

  await prisma.projeto.create({
    data: {
      empresa_id: empresaId,
      parceiro_id: clienteId,
      nome_projeto: nomeProjeto,
      descricao: descricao || "",
      ref_cliente: refCliente,
      data_inicio: inicio,
      data_fim: fim,
      status,
      centro_custo: centroCusto,
      solicitante: solicitante,
      tipo: tipoProjeto,
      horas_previstas: horasPrevistas ? Number(horasPrevistas) : undefined,
      equipe:
        equipe && equipe.length > 0
          ? {
              connect: equipe.map((usuarioId) => ({
                id: usuarioId,
              })),
            }
          : undefined,
    },
  });
};

const update = async (dto: UpdateProjetoDTO): Promise<void> => {
  const {
    id,
    empresaId,
    clienteId,
    nomeProjeto,
    descricao,
    dataInicio,
    dataFim,
    status,
    horasPrevistas,
    equipe,
    refCliente,
    centroCusto,
    solicitante,
    tipoProjeto,
    isActive,
  } = dto;

  // Validar que o projeto pertence à empresa
  const projetoExiste = await prisma.projeto.findUnique({
    where: { id, empresa_id: empresaId },
  });

  if (!projetoExiste) {
    throw new AppError(
      "Projeto não encontrado ou não pertence a esta empresa.",
      404,
    );
  }

  // Caso tenha o is_active ele desativa
  if (isActive && !nomeProjeto) {
    await prisma.projeto.update({
      where: { id, empresa_id: empresaId },
      data: { is_active: isActive },
    });
    return;
  }

  // validar se por acaso nao pertencerem a empresa
  if (equipe && equipe.length > 0) {
    const colaboradoresValidos = await prisma.empresaUsuarios.count({
      where: {
        usuario_id: { in: equipe },
        empresa_id: empresaId,
      },
    });

    if (colaboradoresValidos !== equipe.length) {
      throw new AppError("Colaboradores não pertence a esta empresa.", 404);
    }
  }

  // Se estiver mudando o cliente, validar que pertence à empresa
  if (clienteId) {
    const clienteValido = await prisma.parceiro.findUnique({
      where: { id: clienteId, empresa_id: empresaId },
    });

    if (!clienteValido) {
      throw new AppError(
        "Cliente não encontrado ou não pertence a esta empresa.",
        404,
      );
    }
  }

  const data: Prisma.projetoUpdateInput = {
    parceiro: clienteId ? { connect: { id: clienteId } } : undefined,
    nome_projeto: nomeProjeto,
    descricao,
    ref_cliente: refCliente,
    data_inicio: dataInicio ? new Date(dataInicio) : undefined,
    data_fim: dataFim ? new Date(dataFim) : undefined,
    horas_previstas: horasPrevistas,
    status,
    centro_custo: centroCusto,
    solicitante: solicitante,
    tipo: tipoProjeto,
    is_active: isActive,
    equipe: equipe
      ? {
          set: equipe.map((usuarioId) => ({
            id: usuarioId,
          })),
        }
      : undefined,
  };

  await prisma.projeto.update({
    where: { id, empresa_id: empresaId },
    data,
  });
};

const remove = async (dto: DeleteProjetoDTO): Promise<void> => {
  const { id, empresaId } = dto;

  // Validar que o projeto pertence à empresa
  const projetoExiste = await prisma.projeto.findUnique({
    where: { id, empresa_id: empresaId },
  });

  if (!projetoExiste) {
    throw new AppError(
      "Projeto não encontrado ou não pertence a esta empresa.",
      404,
    );
  }

  try {
    await prisma.projeto.delete({
      where: { id, empresa_id: empresaId },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        throw new AppError("Projeto não encontrado.", 404);
      }
      if (error.code === "P2003") {
        throw new AppError(
          "Não é possível excluir: este projeto possui atividades, lançamentos de horas ou despesas vinculadas.",
          400,
        );
      }
    }
    throw error;
  }
};

export const ProjetosService = {
  find,
  create,
  update,
  remove,
};
