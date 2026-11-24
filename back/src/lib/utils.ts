// Arquivo destinado a conter funções utilitárias para o projeto
import { env } from "node:process";
import { InviteTokenPayload } from "@/entities/convite/convite.dto";
import { AppError } from "@/lib/errors/AppError";
import prisma from "@/prisma";
import { Cargos, Prisma, StatusProjeto } from "@prisma/client";
import type { projeto, atividade } from "@prisma/client";
import jwt from "jsonwebtoken";

// validar o limite de tempo ou data fim apenas para podermos gerar o toast 
// no front para inserir uma atividade de projeto ou atividade
export const limitCheck = (
  projAtv: Partial<projeto> | Partial<atividade>,
): boolean => {
  if (!projAtv.horas_previstas) {
    // nao ha limite para projetos ou atividades em aberto!
    return false;
  }

  if (
    (projAtv.horas_gastas && Number(projAtv.horas_gastas) > 0) &&
    (projAtv.horas_previstas && Number(projAtv.horas_previstas) > 0) &&
    Number(projAtv.horas_gastas) >= Number(projAtv.horas_previstas)
  ) {
    return true;
  } else if (projAtv.data_fim && projAtv.data_fim <= new Date()) {
    return true;
  } else if (
    typeof projAtv === "object" &&
    "status" in projAtv &&
    (StatusProjeto.Finalizado === projAtv?.status ||
      StatusProjeto.Cancelado === projAtv?.status)
  ) {
    return true;
  }

  return false;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `true` se o valor é uma string no formato uuid (ids de rota e de corpo). */
export const isUuid = (valor: unknown): valor is string =>
  typeof valor === "string" && UUID_REGEX.test(valor);

export const projectStatusClassByLabel: Record<
  string,
  { class: string; label: string }
> = {
  Orcando: { class: "bg-amber-500", label: "Orcando" },
  EmAndamento: { class: "bg-blue-600", label: "Em Andamento" },
  EmEspera: { class: "bg-green-600", label: "Em Espera" },
  Cancelado: { class: "bg-red-600", label: "Cancelado" },
  finalizado: { class: "bg-green-600", label: "Finalizado" },
};

/**
 * Ajusta `horas_gastas` da atividade e do projeto com `increment`.
 * Sempre recebe o `tx` de `prisma.$transaction`, para gravar junto com o lançamento.
 */
export const recalcularHorasGastas = async (
  atividadeId: string,
  projetoId: string,
  mudancaHoras: number,
  client: Prisma.TransactionClient,
): Promise<void> => {
  if (mudancaHoras === 0) return;

  if (atividadeId) {
    await client.atividade.update({
      where: { id: atividadeId },
      data: {
        horas_gastas: {
          increment: mudancaHoras,
        },
      },
    });
  }

  if (projetoId) {
    await client.projeto.update({
      where: { id: projetoId },
      data: {
        horas_gastas: {
          increment: mudancaHoras,
        },
      },
    });
  }
};

/**
 * Cargo do usuário na empresa (`empresaUsuarios.cargo`), consultado no banco.
 * Retorna `null` se o usuário não tiver vínculo com a empresa.
 */
export const getCargoUsuario = async (
  usuarioId: string,
  empresaId: string,
): Promise<Cargos | null> => {
  const vinculo = await prisma.empresaUsuarios.findUnique({
    where: {
      usuario_id_empresa_id: { usuario_id: usuarioId, empresa_id: empresaId },
    },
    select: { cargo: true },
  });

  return vinculo?.cargo ?? null;
};

/**
 * OWNER/ADMIN veem e alteram os lançamentos da empresa (e as despesas e dados derivados deles);
 * COLAB, só os próprios. O cargo vem de `empresaUsuarios` (nunca da query ou do corpo).
 * Lança 403 se o usuário não tiver vínculo com a empresa.
 */
export const podeVerLancamentosDaEmpresa = async (
  usuarioId: string,
  empresaId: string,
): Promise<boolean> => {
  const cargo = await getCargoUsuario(usuarioId, empresaId);
  if (!cargo) {
    throw new AppError("Usuário não pertence a esta empresa.", 403);
  }
  return cargo === Cargos.OWNER || cargo === Cargos.ADMIN;
};

export const decodeJWTconvite = (token: string): InviteTokenPayload => {
  if (!env.JWT_SECRET) {
    throw new Error("JWT_SECRET não configurado.");
  }
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (
    typeof decoded === "string" ||
    typeof decoded.email !== "string" || !decoded.email.trim() ||
    typeof decoded.nome !== "string" || !decoded.nome.trim() ||
    typeof decoded.idd !== "string" || !decoded.idd.trim() ||
    typeof decoded.exp !== "number"
  ) {
    throw new jwt.JsonWebTokenError("Token de convite inválido.");
  }

  return { email: decoded.email, nome: decoded.nome, idd: decoded.idd };
}
