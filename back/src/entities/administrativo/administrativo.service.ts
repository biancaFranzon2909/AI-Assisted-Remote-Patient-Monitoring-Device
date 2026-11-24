import prisma from "@/prisma";
import { administrativo, Cargos, Prisma, TipoAdministrativo } from "@prisma/client";
import {
  AdministrativoIdDTO,
  CreateAdministrativoDTO,
  GetAdministrativoDTO,
  UpdateAdministrativoDTO,
} from "./administrativo.dto"
import { AppError } from "@/lib/errors/AppError";
import { getCargoUsuario } from "@/lib/utils";

type AdministrativoComUsuario = Prisma.administrativoGetPayload<{
  include: { usuario: { omit: { hash_senha: true } } };
}>;

/** O usuário do evento precisa ter vínculo com a mesma empresa. */
const validateUsuarioDaEmpresa = async (usuarioId: string, empresaId: string): Promise<void> => {
  const cargo = await getCargoUsuario(usuarioId, empresaId);
  if (!cargo) {
    throw new AppError("Usuário informado não pertence a esta empresa.", 400);
  }
};

const validatePeriodo = (data_inicio: Date, data_fim: Date): void => {
  if (data_inicio.getTime() > data_fim.getTime()) {
    throw new AppError("A data de início não pode ser posterior à data de fim.", 400);
  }
};

const validateNoConflict = async ({
  tipo,
  data_inicio,
  data_fim,
  usuarioId,
  empresaId,
  excludeId,
}: {
  tipo: TipoAdministrativo;
  data_inicio: Date;
  data_fim: Date;
  usuarioId?: string;
  empresaId: string;
  excludeId?: string;
}): Promise<void> => {
  if (tipo === TipoAdministrativo.EVENTO || !usuarioId) return;

  const conflito = await prisma.administrativo.findFirst({
    where: {
      empresaId,
      usuarioId,
      tipo: { in: [TipoAdministrativo.FERIAS, TipoAdministrativo.FALTA] },
      data_inicio: { lte: data_fim },
      data_fim: { gte: data_inicio },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });

  if (conflito) {
    throw new AppError("Impossível criar ou atualizar este evento!");
  }
};

const create = async (dto: CreateAdministrativoDTO): Promise<administrativo> => {
  const { tipo, titulo, data_inicio, data_fim, usuarioId, empresaId } = dto;

  validatePeriodo(data_inicio, data_fim);

  if (usuarioId) {
    await validateUsuarioDaEmpresa(usuarioId, empresaId);
  }

  await validateNoConflict({ tipo, data_inicio, data_fim, usuarioId, empresaId });

  const admEntry = await prisma.administrativo.create({
    data: {
      tipo,
      titulo,
      data_inicio,
      data_fim,
      usuarioId,
      empresaId
    }
  })
  return admEntry;
};

const update = async (dto: UpdateAdministrativoDTO): Promise<administrativo> => {
  const { id, empresaId, tipo: novoTipo, titulo, data_inicio: novoInicio, data_fim: novoFim, usuarioId: novoUsuarioId } = dto;

  // Escopo da empresa na consulta: evento de outra empresa responde 404
  const currentEntry = await prisma.administrativo.findFirst({ where: { id, empresaId } });

  if (!currentEntry) {
    throw new AppError("Evento administrativo não encontrado.", 404);
  }

  if (novoUsuarioId && novoUsuarioId !== currentEntry.usuarioId) {
    await validateUsuarioDaEmpresa(novoUsuarioId, empresaId);
  }

  const tipo = novoTipo ?? currentEntry.tipo;
  const data_inicio = novoInicio ?? currentEntry.data_inicio;
  const data_fim = novoFim ?? currentEntry.data_fim;
  const usuarioId = novoUsuarioId ?? currentEntry.usuarioId ?? undefined;

  validatePeriodo(data_inicio, data_fim);

  await validateNoConflict({
    tipo,
    data_inicio,
    data_fim,
    usuarioId,
    empresaId,
    excludeId: id,
  });

  // Lista de campos permitidos: `empresaId` nunca é alterado
  const admEntry = await prisma.administrativo.update({
    where: { id, empresaId },
    data: {
      tipo: novoTipo,
      titulo,
      data_inicio: novoInicio,
      data_fim: novoFim,
      usuarioId: novoUsuarioId,
    },
  });
  return admEntry;
};

const findMany = async (dto: GetAdministrativoDTO): Promise<AdministrativoComUsuario[]> => {
  const { empresaId, usuarioId } = dto;

  const cargo = await getCargoUsuario(usuarioId, empresaId);
  const verEmpresa = cargo === Cargos.OWNER || cargo === Cargos.ADMIN;

  // COLAB só vê os próprios eventos
  return await prisma.administrativo.findMany({
    where: {
      empresaId,
      usuarioId: verEmpresa ? undefined : usuarioId,
    },
    include: {
      usuario: { omit: { hash_senha: true } },
    },
  });
};

const remove = async (dto: AdministrativoIdDTO): Promise<void> => {
  const { count } = await prisma.administrativo.deleteMany({
    where: { id: dto.id, empresaId: dto.empresaId },
  });

  if (count === 0) {
    throw new AppError("Evento administrativo não encontrado.", 404);
  }
}


export const AdministrativoService = {
  create, 
  findMany,
  update,
  remove
}