import { AppError } from "@/lib/errors/AppError";
import type { SetCompartilhadoDTO } from "./partner.dto";
import prisma from "@/prisma";

const setCompartilhado = async (dto: SetCompartilhadoDTO): Promise<void> => {
  const { projetoId, clienteId, empresaId, atividades } = dto;

  // Validar que o projeto pertence à empresa e ao cliente informado
  const projeto = await prisma.projeto.findUnique({
    where: { id: projetoId, empresa_id: empresaId, parceiro_id: clienteId },
    select: { id: true },
  });

  if (!projeto) {
    throw new AppError(
      "Projeto não encontrado ou não pertence a esta empresa/cliente.",
      404,
    );
  }

  // Validar que todas as atividades pertencem ao projeto
  if (atividades.length > 0) {
    const atividadesValidas = await prisma.atividade.count({
      where: {
        id: { in: atividades },
        projeto_id: projetoId,
        empresa_id: empresaId,
      },
    });

    if (atividadesValidas !== atividades.length) {
      throw new AppError(
        "Uma ou mais atividades não pertencem a este projeto.",
        400,
      );
    }
  } 

  // Seta projeto e atividades como compartilhados em paralelo
  await Promise.all([
    prisma.projeto.update({
      where: { id: projetoId },
      data: { compartilhado: true },
    }),
    atividades && atividades.length > 0
      ? prisma.atividade.updateMany({
          where: { id: { in: atividades }, projeto_id: projetoId },
          data: { compartilhado: true },
        })
      : prisma.atividade.updateMany({
          where: { projeto_id: projetoId },
          data: { compartilhado: false },
        }),,
  ]);
};

const unsetCompartilhado = async (dto: Omit<SetCompartilhadoDTO, "atividades"> & { atividades?: string[] }): Promise<void> => {
  const { projetoId, clienteId, empresaId, atividades } = dto;

  const projeto = await prisma.projeto.findUnique({
    where: { id: projetoId, empresa_id: empresaId, parceiro_id: clienteId },
    select: { id: true },
  });

  if (!projeto) {
    throw new AppError(
      "Projeto não encontrado ou não pertence a esta empresa/cliente.",
      404,
    );
  }

  await Promise.all([
    prisma.projeto.update({
      where: { id: projetoId },
      data: { compartilhado: false },
    }),
    atividades && atividades.length > 0
      ? prisma.atividade.updateMany({
          where: { id: { in: atividades }, projeto_id: projetoId },
          data: { compartilhado: false },
        })
      : prisma.atividade.updateMany({
          where: { projeto_id: projetoId },
          data: { compartilhado: false },
        }),
  ]);
};

export const PartnerService = {
  setCompartilhado,
  unsetCompartilhado,
};
