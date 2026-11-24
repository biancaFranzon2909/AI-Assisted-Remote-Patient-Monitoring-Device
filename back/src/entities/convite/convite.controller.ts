import { errorHandler } from "@/lib/errors/AppError";
import { InviteError } from "@/lib/errors/InviteError";
import { InviteService } from "./convite.service";
import { env } from "node:process";

// ─── POST /convite/create ─────────────────────────────────────────────────────────
const postInvite = async (req: request, res: response): Promise<void> => {
  const { nome, email } = req.body ?? {};

  try {
    await InviteService.invite({
      nome,
      email,
      empresaId: req.user?.empresaId as string,
    });

    res.status(200).json({
      error: false,
      message: "Convite enviado com sucesso!",
    });
  } catch (error) {
    errorHandler(res, error, "InviteController");
  }
};

// ─── GET /convite/aceite/:token ─────────────────────────────────────────────────────────
const getAcceptInvite = async (req: request, res: response): Promise<void> => {
  const token = req.params.token as string;
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");

  try {
    const { payload, empresa, usuario } = await InviteService.inspect(token);
    const usuarioLogadoId = req.user?.usuario_id;
    if (usuario && usuario.id === usuarioLogadoId) {
      await InviteService.accept(token, usuario.id);
      res.redirect(`${env.FRONTEND_URL}/`);
      return;
    }

    const redirectUrl = new URL(`${env.FRONTEND_URL}/login`);
    redirectUrl.searchParams.set("email", payload.email);
    redirectUrl.searchParams.set("nome", payload.nome);
    redirectUrl.searchParams.set("nome_empresa", empresa.nome_empresa);
    redirectUrl.searchParams.set("isNewUser", String(!usuario));
    redirectUrl.searchParams.set("tk", token);
    res.redirect(redirectUrl.toString());
  } catch (error) {
    if (error instanceof InviteError) {
      const redirectUrl = new URL(`${env.FRONTEND_URL}/login`);
      redirectUrl.searchParams.set(error.code, "true");
      res.redirect(redirectUrl.toString());
      return;
    }
    errorHandler(res, error, "InviteController.getAcceptInvite");
  }
};

// Essa rota faz com que quando o usuário quando já existente seja vinculado a empresa
//─── POST /convite/aceitar/:token ─────────────────────────────────────────────────────────
const postAceitarConvite = async (req: request, res: response): Promise<void> => {
  const usuarioId = req.user?.usuario_id;
  if (typeof usuarioId !== "string" || !usuarioId) {
    res.status(401).json({ error: true, message: "Não autenticado." });
    return;
  }

  try {
    await InviteService.accept(req.params.token as string, usuarioId);
    res.status(200).json({ error: false, message: "Convite aceito com sucesso!" });
  } catch (error) {
    if (error instanceof InviteError) {
      res.status(error.statusCode).json({ error: true, code: error.code, message: error.message });
      return;
    }
    errorHandler(res, error, "InviteController");
  }
};

export default {
  postInvite,
  getAcceptInvite,
  postAceitarConvite
};
