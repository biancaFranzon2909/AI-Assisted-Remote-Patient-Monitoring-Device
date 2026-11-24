import { parceiro, parceria, Prisma } from "@prisma/client";
import { AppError } from "@/lib/errors/AppError";
import type {
  GetClientesDTO,
  CreateClienteDTO,
  UpdateClienteDTO,
  DeleteClienteDTO,
  GetClienteProjetosDTO,
  ClienteListItem,
} from "./clientes.dto";
import { podeVerLancamentosDaEmpresa, projectStatusClassByLabel } from "@/lib/utils";
import TimeStamps from "@/lib/TimeStamps";
import prisma from "@/prisma";

const find = async (dto: GetClientesDTO): Promise<ClienteListItem[] | any> => {
  const { is_active, clienteId, empresaId, usuarioId } = dto;
  if (clienteId) {
    return await findById(clienteId, empresaId, usuarioId);
  }

  const where: Prisma.parceiroWhereInput = {
    is_active: is_active === "all" ? undefined : is_active === "false" ? false : true,
    empresa_id: empresaId,
  };

  const clientes = await prisma.parceiro.findMany({
    where,
    include: { 
      projetos: true, 
      _count: { select: { projetos: true } },
    },
    orderBy: [
      { nome_fantasia: "asc" },
      { projetos: { _count: "desc" } },
    ],
  });

  const todosClientes: ClienteListItem[] = [
    ...clientes.map((client) => ({
      clienteId: client.id,
      nomeFantasia: client.nome_fantasia,
      razaoSocial: client.razao_social,
      email: client.email,
      localizacao: `${client.cidade}/${client.estado}`,
      cnpj: client.cnpj,
      cep: client.cep,
      endereco: client.endereco,
      projetos: client._count.projetos,
      status: client.is_active,
    })),
  ];

  return todosClientes;
};

const findById = async (
  id: string,
  empresaId: string,
  usuarioId: string,
): Promise<any> => {
  // COLAB: o total de despesas considera só as despesas dos próprios lançamentos
  const [verEmpresa, cliente] = await Promise.all([
    podeVerLancamentosDaEmpresa(usuarioId, empresaId),
    prisma.parceiro.findUnique({
      where: {
        id,
        OR: [
          { empresa_id: empresaId },
          {
            parceria: {
              empresa_parceira_id: empresaId,
              is_active: true,
            },
          },
        ],
      },
      select: {
        id: true,
        empresa_id: true,
        nome_fantasia: true,
        razao_social: true,
        inscricao_estadual: true,
        website: true,
        nota_interna: true,
        pais: true,
        email: true,
        cnpj: true,
        cep: true,
        endereco: true,
        cidade: true,
        estado: true,
        parceria: {
          select: {
            empresa_parceira: {
              select: {
                identificador: true,
              },
            },
          },
        },
        is_active: true,
        projetos: {
          where: {
            OR: [{ empresa_id: empresaId }, { compartilhado: true }],
          },
          select: {
            id: true,
            nome_projeto: true,
            horas_previstas: true,
            horas_gastas: true,
            compartilhado: true,
            status: true,
          },
        },
      },
    }),
  ]);

  if (!cliente) {
    throw new AppError("Cliente não encontrado.", 404);
  }

  // Visto pela empresa parceira (não dona): sem dados internos da dona
  const compartilhado = cliente.empresa_id !== empresaId;

  // Despesas visíveis ao ator: dona → atividades da própria empresa;
  // parceira → só lançamentos de usuários da empresa do ator em projeto/atividade compartilhados.
  const escopoLancamento: Prisma.lancamentoWhereInput = compartilhado
    ? {
        usuario: { empresas: { some: { empresa_id: empresaId } } },
        atividade: {
          compartilhado: true,
          projeto: { compartilhado: true, parceiro_id: id },
        },
      }
    : {
        atividade: {
          empresa_id: empresaId,
          projeto: { parceiro_id: id },
        },
      };

  if (!verEmpresa) {
    escopoLancamento.usuario_id = usuarioId;
  }

  // soma real de despesas via aggregate, agrupada por lançamento
  const despesasPorLancamento = await prisma.despesa.groupBy({
    by: ["lancamento_id"],
    _sum: { valor: true },
    where: { lancamento: escopoLancamento },
  });

  return {
    clienteId: cliente.id,
    nomeFantasia: cliente.nome_fantasia,
    razaoSocial: cliente.razao_social,
    inscricaoEstadual: cliente.inscricao_estadual,
    website: cliente.website,
    notaInterna: compartilhado ? null : cliente.nota_interna,
    pais: cliente.pais,
    email: cliente.email,
    cidade: cliente.cidade,
    estado: cliente.estado,
    cnpj: cliente.cnpj,
    cep: cliente.cep,
    endereco: cliente.endereco,
    identificadorParceiro: cliente.parceria?.empresa_parceira?.identificador,
    projetosNumero: cliente.projetos.length,
    status: cliente.is_active,
    compartilhado,
    projetos: cliente.projetos.map((projeto) => ({
      compartilhado: projeto.compartilhado,
      projetoId: projeto.id,
      nomeProjeto: projeto.nome_projeto,
      horasPrevistas: projeto.horas_previstas,
      horasGastas: projeto.horas_gastas ?? 0,
      statusLabel:
        projectStatusClassByLabel[projeto.status]?.label || "Desconhecido",
      statusClass: projectStatusClassByLabel[projeto.status]?.class || {
        class: "bg-gray-500",
        label: "Desconhecido",
      },
    })).sort((a, b) => a.nomeProjeto.localeCompare(b.nomeProjeto)),
    totalDespesas: despesasPorLancamento.reduce(
      (acc, curr) => acc + Number(curr._sum.valor ?? 0),
      0,
    ),
    totalHorasGastas: new TimeStamps().getWatchHour(
      cliente.projetos.reduce(
        (acc, projeto) => acc + Number(projeto.horas_gastas ?? 0),
        0,
      ),
    ),
  };
};

const create = async (dto: CreateClienteDTO): Promise<any> => {
  const {
    cep,
    cidade,
    cnpj,
    email,
    endereco,
    estado,
    inscricaoEstadual,
    nomeFantasia,
    razaoSocial,
    notaInterna,
    pais,
    website,
    empresaId
  } = dto;

  const duplicado = await prisma.parceiro.findFirst({
    where: { cnpj: cnpj },
  });

  if (duplicado) {
    throw new AppError("CNPJ já existente", 409);
  }

  return prisma.parceiro.create({
    data: {
      cep,
      cidade,
      cnpj,
      email: email ?? "",
      endereco,
      estado,
      inscricao_estadual: inscricaoEstadual,
      nome_fantasia: nomeFantasia ?? "",
      razao_social: razaoSocial,
      nota_interna: notaInterna,
      pais,
      website,
      empresa_id: empresaId,
    },
  });
};

const update = async (dto: UpdateClienteDTO): Promise<any> => {
  const {
    id,
    userId,
    empresaId,
    cep,
    cidade,
    cnpj,
    email,
    endereco,
    estado,
    inscricaoEstadual,
    nomeFantasia,
    notaInterna,
    pais,
    razaoSocial,
    website,
    status,
    identificadorParceria,
  } = dto;

  // Validar que o cliente pertence à empresa
  const clienteExiste = await prisma.parceiro.findUnique({
    where: { id, empresa_id: empresaId },
  });

  if (!clienteExiste) {
    throw new AppError(
      "Cliente não encontrado ou não pertence a esta empresa.",
      404,
    );
  }

  // Caso tenha o is_active ele desativa
  if (status && !nomeFantasia && !razaoSocial) {
    await prisma.parceiro.update({
      where: { id, empresa_id: empresaId },
      data: { is_active: status },
    });
    return;
  }

  // Validar CNPJ
  if (cnpj) {
    const duplicado = await prisma.parceiro.findFirst({
      where: { cnpj: cnpj, id: { not: id } },
    });

    if (duplicado) {
      throw new AppError("CNPJ já existente", 409);
    }
  }

  let data: Partial<parceiro> = {
    cep,
    cidade,
    cnpj,
    email,
    endereco,
    estado,
    inscricao_estadual: inscricaoEstadual,
    nome_fantasia: nomeFantasia,
    razao_social: razaoSocial,
    nota_interna: notaInterna,
    pais,
    website,
    is_active: status,
  };

  let parceria: parceria;
  if (identificadorParceria && identificadorParceria.trim() !== "") {
    const empresa = await prisma.empresa.findUnique({
      where: {
        identificador: identificadorParceria,
      },
    });

    if (!empresa || !empresa.id)
      throw new AppError(
        "Empresa nao encontrada para o identificador informado",
        404,
      );

    parceria = await prisma.parceria.upsert({
      where: {
        parceiro_id: id,
      },
      create: {
        empresa_id: empresaId,
        parceiro_id: id,
        empresa_parceira_id: empresa.id,
        criado_por: userId,
      },
      update: {
        empresa_parceira_id: empresa.id,
        empresa_id: empresaId,
        criado_por: userId,
      },
    });

    data.parceria_id = parceria.id;
  } else {
    await prisma.parceria.deleteMany({
      where: { parceiro_id: id },
    });
    data.parceria_id = null;
  }

  await prisma.parceiro.update({
    where: { id },
    data,
  });

  return;
};

const remove = async (dto: DeleteClienteDTO): Promise<void> => {
  const { id, empresaId } = dto;

  // Validar que o cliente pertence à empresa
  const cliente = await prisma.parceiro.findUnique({
    where: { id, empresa_id: empresaId },
  });

  if (!cliente) {
    throw new AppError(
      "Cliente não encontrado ou não pertence a esta empresa.",
      404,
    );
  }

  await prisma.parceiro.delete({ where: { id } });
};

const findProjetos = async (dto: GetClienteProjetosDTO): Promise<any[]> => {
  const { id, empresaId } = dto;

  // Validar que o cliente pertence à empresa
  const cliente = await prisma.parceiro.findUnique({
    where: { id, empresa_id: empresaId },
  });

  if (!cliente) {
    throw new AppError(
      "Cliente não encontrado ou não pertence a esta empresa.",
      404,
    );
  }

  return prisma.projeto.findMany({
    where: { parceiro_id: id, empresa_id: empresaId },
    orderBy: { id: "desc" },
  });
};

export const ClientesService = {
  find,
  create,
  update,
  remove,
  findProjetos,
};
