import { Prisma } from "@prisma/client";
import { argon2 } from "@/lib/argon";
import { AppError } from "@/lib/errors/AppError";

import type {
  GetUsuariosDTO,
  CreateUsuarioDTO,
  UpdatePwdDTO,
  GetMeDTO,
  Me,
  UsuarioList,
  UsuarioById,
  UserStatsDTO,
  UserStats,
  InactivateUsuarioDTO,
} from "./usuarios.dto";
import TimeStamps from "@/lib/TimeStamps";
import { getCargoUsuario, podeVerLancamentosDaEmpresa } from "@/lib/utils";
import prisma from "@/prisma";

const find = async (
  dto: GetUsuariosDTO,
): Promise<UsuarioList[] | UsuarioById> => {
  const { usuarioId, empresaId, atorId } = dto;
  if (usuarioId) {
    return await findById(usuarioId, empresaId, atorId);
  }

  const where: Prisma.empresaUsuariosWhereInput = {
    empresa_id: empresaId,
  };

  const usuarios = await prisma.empresaUsuarios.findMany({
    where,
    include: {
      usuario: {
        select: {
          id: true,
          nome_usuario: true,
          nome_completo: true,
          email: true,
          is_active: true,
          empresas: {
            where: {
              empresa: {
                id: empresaId,
              },
            },
            select: {
              cargo: true,
            },
          },
        },
      },
    },
    orderBy: {
      usuario: {
        nome_completo: "asc",
      },
    },
  });

  if (usuarios.length < 1) {
    throw new AppError("Nenhum usuário encontrado.", 404);
  }

  return usuarios.map((u) => ({
    usuarioId: u.usuario.id,
    nomeCompleto: u.usuario.nome_completo,
    nomeUsuario: u.usuario.nome_usuario,
    email: u.usuario.email,
    isActive: u.usuario.is_active,
    cargo: u.usuario.empresas[0].cargo,
  }));
};

/**
 * Detalhe de um usuário da empresa do ator (BOLA: sem vínculo com a empresa → 404).
 * Os lançamentos só vêm quando o alvo é o próprio ator ou o ator é OWNER/ADMIN;
 * para COLAB consultando colega, `lancamentos` volta vazio.
 */
const findById = async (
  id: string,
  empresaId: string,
  atorId: string,
): Promise<UsuarioById> => {
  const verEmpresa = await podeVerLancamentosDaEmpresa(atorId, empresaId);

  const usuario = await prisma.usuario.findFirst({
    where: { id, empresas: { some: { empresa_id: empresaId } } },
    select: {
      id: true,
      nome_usuario: true,
      nome_completo: true,
      email: true,
      is_active: true,
      empresas: {
        where: { empresa_id: empresaId },
        select: {
          cargo: true,
        },
      },
      projetos: {
        where: { empresa_id: empresaId },
        select: {
          id: true,
          nome_projeto: true,
          atividades: {
            select: {
              id: true,
              nome_atividade: true,
            },
          },
        },
      },
    },
  });

  if (!usuario) {
    throw new AppError("Usuário não encontrado.", 404);
  }

  const lancamentos =
    verEmpresa || id === atorId
      ? await prisma.lancamento.findMany({
          where: {
            usuario_id: id,
            atividade: { projeto: { empresa_id: empresaId } },
          },
          orderBy: { data_lancamento: "desc" },
          select: {
            id: true,
            descricao: true,
            duracao_total: true,
            data_lancamento: true,
            hora_inicio: true,
            hora_fim: true,
            atividade: {
              select: {
                id: true,
                nome_atividade: true,
                projeto: {
                  select: {
                    nome_projeto: true,
                    id: true,
                  },
                },
              },
            },
          },
        })
      : [];

  return {
    id: usuario.id,
    nomeUsuario: usuario.nome_usuario,
    nomeCompleto: usuario.nome_completo,
    email: usuario.email,
    isActive: usuario.is_active,
    cargo: usuario.empresas[0]?.cargo,
    projetos: usuario.projetos.map((p) => ({
      projetoId: p.id,
      projetoNome: p.nome_projeto,
      atividades: p.atividades.map((a) => ({
        atividadeId: a.id,
        nomeAtividade: a.nome_atividade,
      })),
    })),
    lancamentos: lancamentos.map((l) => ({
      lancamentoId: l.id,
      descricao: l.descricao,
      duracaoTotal: l.duracao_total,
      dataLancamento: l.data_lancamento,
      horaInicio: l.hora_inicio,
      horaFim: l.hora_fim,
      atividade: {
        atividadeId: l.atividade.id,
        nomeAtividade: l.atividade.nome_atividade,
        projeto: {
          projetoId: l.atividade.projeto.id,
          nomeProjeto: l.atividade.projeto.nome_projeto,
        },
      },
    })),
  };
};

const getMe = async (dto: GetMeDTO): Promise<Me> => {
  const { usuarioId } = dto;

  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: {
      id: true,
      nome_usuario: true,
      nome_completo: true,
      email: true,
      is_active: true,
      api_key: true,
    },
  });

  if (!usuario || !usuario.is_active) {
    throw new AppError("Não autenticado.", 401);
  }

  const empresas = (
    await prisma.empresaUsuarios.findMany({
      where: {
        usuario_id: usuarioId,
      },
      orderBy: {
        empresa: {
          criado_em: "asc",
        },
      },
      include: {
        empresa: {
          select: {
            nome_empresa: true,
            identificador: true,
          },
        },
      },
    })
  ).map((emp) => ({
    nomeEmpresa: emp.empresa.nome_empresa,
    identificador: emp.empresa.identificador,
    cargo: emp.cargo,
  }));

  const returnableUser: Me = {
    id: usuario.id,
    apiKey: usuario.api_key?.key ?? "",
    email: usuario.email ?? "",
    isActive: usuario.is_active,
    nomeCompleto: usuario.nome_completo ?? "",
    nomeUsuario: usuario.nome_usuario,
    empresas: empresas,
  };

  return returnableUser;
};

const create = async (dto: CreateUsuarioDTO): Promise<any> => {
  const { nomeUsuario, senha, nomeCompleto, email } = dto;

  const pwd = await argon2.hash(senha);
  const existingUser = await prisma.usuario.findFirst({
    where: {
      OR: [{ nome_usuario: nomeUsuario }, { email }],
      is_active: true,
    },
  });

  if (existingUser) {
    throw new AppError("O nome de usuário ou e-mail já está em uso.", 400);
  }

  const usuario = await prisma.usuario.create({
    data: {
      nome_usuario: nomeUsuario,
      nome_completo: nomeCompleto,
      email,
      hash_senha: pwd,
    },
  });
  return {
    id: usuario.id,
    nomeUsuario: usuario.nome_usuario,
    nomeCompleto: usuario.nome_completo,
    email: usuario.email,
    isActive: usuario.is_active,
  };
};

const updatePassword = async (dto: UpdatePwdDTO): Promise<void> => {
  const { usuarioId, senhaAtual, senhaNova } = dto;

  if (!senhaAtual) {
    throw new AppError("A senha atual é obrigatória.", 400);
  }

  const user = await prisma.usuario.findUnique({
    where: { id: usuarioId },
  });

  if (!user) {
    throw new AppError("Usuário não encontrado.", 404);
  }

  if (senhaAtual) {
    const senhaCorreta = await argon2.verify(user.hash_senha, senhaAtual);
    if (!senhaCorreta) {
      throw new AppError("Senha atual incorreta.", 401);
    }
  }

  const novaSenha = await argon2.hash(senhaNova.trim());

  await prisma.usuario.update({
    where: { id: usuarioId },
    data: { hash_senha: novaSenha },
  });
};

const userStats = async (dto: UserStatsDTO): Promise<UserStats> => {
  const { usuarioId, empresaId, atorId } = dto;

  // COLAB só consulta a si mesmo; alvo sem vínculo com a empresa → 404 (BOLA)
  const verEmpresa = await podeVerLancamentosDaEmpresa(atorId, empresaId);
  if (!verEmpresa && usuarioId !== atorId) {
    throw new AppError("Usuário não encontrado.", 404);
  }

  if (!(await getCargoUsuario(usuarioId, empresaId))) {
    throw new AppError("Usuário não encontrado.", 404);
  }

  /**
   * Requisitos para a rota:
   * - OWNER/ADMIN consultam qualquer usuário da empresa; COLAB, só a si mesmo
   * - Recebe usuarioId e empresaId como filtros obrigatórios
   * - totalHorasLancadas: total de horas lançadas pelo usuário (soma de duracao_total) no mês
   * - totalLancamentos: total de lançamentos realizados no mês
   * - totalProjetos: total de projetos vinculados ao usuário na empresa
   * - totalAtividades: total de atividades vinculadas ao usuário na empresa
   * - horasPorProjeto: horas lançadas agrupadas por projeto no mês
   *
   * Ja deixar criado a rota /usuarios/stats/:usuarioId nos controllers e indexado no router
   */

  // src\entities\usuarios\usuarios.service.ts
  // Total de horas lançadas
  const hoje = new TimeStamps().getDia();
  const mes = new TimeStamps().getRangeMonth();

  // where clause
  const where = {
    usuario_id: usuarioId,
    atividade: { empresa_id: empresaId },
    data_lancamento: { gte: mes.from, lt: mes.to },
  };

  const lancamentosMes = await prisma.lancamento.findMany({
    where,
    select: {
      duracao_total: true,
      atividade: {
        select: {
          projeto: {
            select: {
              id: true,
              nome_projeto: true,
            },
          },
        },
      },
    },
  });

  const totalHorasLancadas = await prisma.lancamento.aggregate({
    where,
    _sum: {
      duracao_total: true,
    },
  });

  // Projetos alocados ao usuário
  const totalProjetos = (
    await prisma.projeto.aggregate({
      where: {
        empresa_id: empresaId,
        equipe: { some: { id: usuarioId } },
      },
      _count: {
        id: true,
      },
    })
  )._count.id;

  // Total de atividades alocadas ao usuário
  const totalAtividades = (
    await prisma.atividade.aggregate({
      where: {
        empresa_id: empresaId,
        projeto: { equipe: { some: { id: usuarioId } } },
      },
      _count: {
        id: true,
      },
    })
  )._count.id;

  type ProjetoLancamentoRaw = {
    projeto_id: string;
    nome_projeto: string;
    total_duracao: number | null;
  };

  const projetosLancamentos = await prisma.$queryRaw<ProjetoLancamentoRaw[]>`
  SELECT
    l.projeto_id,
    p.nome_projeto,
    SUM(l.duracao_total) AS total_duracao
  FROM "lancamento" l
  INNER JOIN "atividade" a ON a.id = l.atividade_id
  INNER JOIN "projeto" p ON p.id = l.projeto_id
  WHERE l.usuario_id = ${usuarioId}
    AND a.empresa_id = ${empresaId}
  GROUP BY l.projeto_id, p.nome_projeto;
  `;

  const horasPorProjeto = projetosLancamentos.map((item) => ({
    projetoId: item.projeto_id,
    nomeProjeto: item.nome_projeto,
    totalHoras: new TimeStamps().getWatchHour(Number(item.total_duracao || 0)),
  }));

  // const ProjetosLancamentos = await prisma.lancamento.groupBy({
  //   by: ["projeto_id"],
  //   where,
  //   _sum: {
  //     duracao_total: true,
  //   },
  //   _count: {
  //     id: true,
  //   },
  // })

  // const horasPorProjeto = [];

  // for (const projeto of ProjetosLancamentos) {
  //   const id = projeto.projeto_id;
  //   const projetoNome = (await prisma.projeto.findUnique({
  //     where: { id: projeto.projeto_id},
  //   }))?.nome_projeto;
  //   const totalHoras = new TimeStamps().getWatchHour(projeto._sum.duracao_total || 0)

  //   horasPorProjeto.push({
  //     projetoId: id,
  //     nomeProjeto: projetoNome || "",
  //     totalHoras,
  //   })
  // }

  return {
    totalHorasLancadas: new TimeStamps().getWatchHour(
      totalHorasLancadas._sum.duracao_total ?? 0,
    ),
    totalLancamentos: lancamentosMes.length,
    totalProjetos,
    totalAtividades,
    horasPorProjeto,
  };
};

const inativarConta = async (dto: InactivateUsuarioDTO): Promise<void> => {
  const { usuarioId } = dto;

  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
  });

  if (!usuario || !usuario.is_active) {
    throw new AppError("Usuário não encontrado ou já inativo.", 404);
  }

  await prisma.$transaction(async (tx) => {
    await tx.usuario.update({
      where: { id: usuarioId },
      data: { is_active: false },
    });

    await tx.token.updateMany({
      where: { usuario_id: usuarioId, revoked_at: null },
      data: { revoked_at: new Date() }, 
    });

    await tx.apiKey.deleteMany({
      where: { usuario_id: usuarioId },
    });
  })
};

export const UsuariosService = {
  find,
  getMe,
  create,
  updatePassword,
  userStats,
  inativarConta,
};
