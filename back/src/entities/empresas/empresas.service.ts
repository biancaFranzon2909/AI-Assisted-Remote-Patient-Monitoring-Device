import crypto from "crypto";
import { AppError } from "@/lib/errors/AppError";
import type {
  CreateEmpresaDTO,
  RemoveUserFromCompanyDTO,
  DeleteCompanyDTO,
  AddUserToCompanyDTO,
} from "./empresas.dto";
import prisma from "@/prisma";

const create = async (
  dto: CreateEmpresaDTO,
): Promise<{ id: string; identificador: string; nome_empresa: string }> => {
  const { nomeEmpresa, identificador, ownerId } = dto;

  const empresaExists = await prisma.empresa.findUnique({
    where: {
      nome_empresa: nomeEmpresa,
    },
  });

  if (empresaExists)
    throw new AppError("Uma empresa ja esta registrada com este nome!", 400);

  let identificadorOptional = !identificador
    ? (
        nomeEmpresa.trim() +
        crypto.randomBytes(2).toString("hex").slice(0, 6).trim()
      )
        .replace(" ", "_")
        .toLowerCase()
    : identificador.trim();

  const empresa = await prisma.empresa.create({
    data: {
      nome_empresa: nomeEmpresa,
      identificador: identificadorOptional,
      criado_por: ownerId,
    },
  });

  await prisma.empresaUsuarios.create({
    data: {
      usuario_id: ownerId,
      empresa_id: empresa.id,
      cargo: "OWNER",
    },
  });

  return {
    id: empresa.id,
    identificador: empresa.identificador,
    nome_empresa: empresa.nome_empresa,
  };
};

const deleteCompany = async (dto: DeleteCompanyDTO): Promise<void> => {
  // Foi pedido paraignorarmos o identificaddor, mas vou deixar comentado caso venhamos a ter que voltar a usar
  // const { identificador } = dto;

  const { usuarioId, empresaId } = dto;
  const ownerUser = await prisma.empresaUsuarios.findFirst({
    where: {
      usuario_id: usuarioId,
      empresa_id: empresaId,
      cargo: "OWNER",
    },
  });

  if (!ownerUser) {
    throw new AppError("Apenas Owners podem deletar a empresa.", 400);
  }

  try {
    await prisma.empresa.delete({
      where: {
        id: empresaId,
      },
    });
  } catch (error) {
    throw new AppError("Empresa não encontrada.", 400);
  }

  return;
};

const removeUserFromCompany = async (
  dto: RemoveUserFromCompanyDTO,
): Promise<void> => {
  const { userId, companyId, userIdRemoval } = dto;

  const ownerUser = await prisma.empresaUsuarios.findFirst({
    where: {
      usuario_id: userId,
      empresa_id: companyId,
      cargo: "OWNER",
    },
  });

  if (ownerUser) {
    throw new AppError("Não é possível remover este usuário!", 400);
  }

  // Sempre vai conferir se é ADMIN ou Owner antes de deixar remover usuários da empresa
  const usuarioPedidoPermissao = await prisma.empresaUsuarios.findFirst({
    where: {
      usuario_id: userIdRemoval,
      empresa_id: companyId,
      cargo: {
        in: ["OWNER", "ADMIN"],
      },
    },
  });

  if (!usuarioPedidoPermissao) {
    throw new AppError("Voce nao pode remover usuários da empresa!", 400);
  }

  await prisma.empresaUsuarios.delete({
    where: {
      usuario_id_empresa_id: {
        usuario_id: userId,
        empresa_id: companyId,
      },
    },
  });

  return;
};

const addUserToCompany = async (
  dto: AddUserToCompanyDTO,
  allowExisting: boolean = false,
): Promise<void> => {
  const { userId, companyId } = dto;

  if (allowExisting) {
    await prisma.empresaUsuarios.upsert({
      where: {
        usuario_id_empresa_id: { usuario_id: userId, empresa_id: companyId },
      },
      create: { usuario_id: userId, empresa_id: companyId },
      update: {},
    });
    return;
  }

  const userExist = (await prisma.empresaUsuarios.findFirst({
    where: {
      usuario_id: userId,
      empresa_id: companyId,
    },
  }))
    ? true
    : false;

  if (userExist) {
    throw new AppError("Usuário já pertence a esta empresa.", 400);
  }

  await prisma.empresaUsuarios.create({
    data: {
      usuario_id: userId,
      empresa_id: companyId,
    },
  });

  return;
};

export const EmpresasService = {
  create,
  deleteCompany,
  addUserToCompany,
  removeUserFromCompany,
};
