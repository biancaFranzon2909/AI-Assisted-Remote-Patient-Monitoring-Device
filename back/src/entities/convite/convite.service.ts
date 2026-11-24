import { AppError } from "@/lib/errors/AppError";
import { InviteError } from "@/lib/errors/InviteError";
import type { 
  InviteUserDTO,
  InviteTokenPayload,
}from "./convite.dto";
import prisma from "@/prisma";
import jwt from "jsonwebtoken";
import { env } from "node:process";
import { decodeJWTconvite } from "@/lib/utils";
import { EmpresasService } from "../empresas/empresas.service";
import resend from "@/lib/mailer"

const INVITE_TOKEN_TTL = "2d";

const invite = async (dto: InviteUserDTO): Promise<void> => {
  const { nome, email, empresaId } = dto;
  if (!email || !nome) throw new AppError("Nome e e-mail são obrigatórios.", 400);

  // TODO - fazer isso no auth middleware
  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
  })

  if (!empresa) throw new AppError("Empresa não encontrada.", 404);

  const usuarioExiste = await prisma.usuario.findUnique({
    where: { email },
    include: { empresas: true }
  });

  if (usuarioExiste) {
    const jaPertenceAEmpresa = usuarioExiste.empresas?.some(
      (e) => e.empresa_id === empresaId
    );

    if (jaPertenceAEmpresa) {
      throw new AppError("Este usuário já faz parte desta empresa.", 400);
    }
  }

  const payload: InviteTokenPayload = { email, nome, idd: empresa.identificador };
  const inviteToken = jwt.sign(payload, env.JWT_SECRET as string , {
    expiresIn: INVITE_TOKEN_TTL,
  });

  try {
    await resend.emails.create({
      from: `Chronotracker <convite${env.RESEND_MAIL}>`,
      to: email,
      template: {
        id: "convite-empresa",
        variables: {
          convidado_nome: nome,
          nome_empresa: empresa.nome_empresa,
          link_aceite:`${env.BACK_END_URL}/convite/aceite/${inviteToken}`
        }
      }
    });
  } catch (error) {
    console.error("Erro ao enviar e-mail com Nodemailer:", error);
    throw new AppError("Falha ao enviar e-mail de convite. Verifique as credenciais SMTP.", 500);
  }
};

/**
 * Esta Funcao inspeciona o token e retorna as validacoes
 * @param token - 
 * @returns 
 */
const inspect = async (token: string) => {
  let decoded: InviteTokenPayload;
  try {
    decoded = decodeJWTconvite(token);
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new InviteError("inviteExpired", "Convite expirado. Solicite um novo convite.");
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new InviteError("inviteInvalid", "Token de convite inválido.");
    }
    throw error;
  }

  const empresa = await prisma.empresa.findUnique({
    where: { identificador: decoded.idd },
    select: { id: true, nome_empresa: true},
  });
  if (!empresa) {
    throw new InviteError("inviteUnavailable", "Empresa do convite não encontrada.", 404);
  }

  const usuario = await prisma.usuario.findUnique({
    where: { email: decoded.email },
    select: { id: true, is_active: true },
  });
  if (usuario && !usuario.is_active) {
    throw new InviteError("accountInactive", "Conta inativa.", 403);
  }

  return { payload: decoded, empresa, usuario };
};

const accept = async (token: string, usuarioId: string): Promise<void> => {
  if (!usuarioId) {
    throw new AppError("Não autenticado.", 401);
  }
  const { empresa, usuario } = await inspect(token);
  if (!usuario || usuario.id !== usuarioId) {
    throw new InviteError("inviteAccountMismatch", "Entre com a conta destinatária do convite.", 403);
  }

  await EmpresasService.addUserToCompany({ userId: usuarioId, companyId: empresa.id, }, true);
};

export const InviteService = { invite, inspect, accept };

