import { errorHandler } from "@/lib/errors/AppError";
import { isUuid } from "@/lib/utils";
import { UsuariosService } from "./usuarios.service";

// ─── GET /usuarios/find/:id ──────────────────────────────────────────────────────
const getUsuarios = async (req: request, res: response): Promise<void> => {
  const usuarioId = req.params.id as string | undefined;
  const empresaId = req.user?.empresaId;
  const atorId = req.user?.usuario_id;

  if (!empresaId || typeof atorId !== "string") {
    res.status(400).json({ error: true, message: "Empresa não identificada." });
    return;
  }

  if (usuarioId !== undefined && !isUuid(usuarioId)) {
    res.status(400).json({ error: true, message: "ID do usuário inválido." });
    return;
  }

  try {
    const data = await UsuariosService.find({
      usuarioId,
      empresaId,
      atorId,
    });
    res.status(200).json({ error: false, data });
  } catch (error) {
    errorHandler(res, error, "UsuariosController");
  }
};

// ─── GET /auth/me ─────────────────────────────────────────────────────────────
const getMe = async (req: request, res: response): Promise<void> => {
  const usuarioId = req.user?.usuario_id;

  if (!usuarioId) {
    res.status(401).json({ error: true, message: "Não autenticado." });
    return;
  }

  try {
    const data = await UsuariosService.getMe({ usuarioId: usuarioId });
    res.status(200).json({ error: false, data });
  } catch (error) {
    errorHandler(res, error, "UsuariosController");
  }
}

// ─── Patch /usuarios/senha ─────────────────────────────────────────────────────
const updatePassword = async (req: request, res: response): Promise<void> => {
  const { senha_atual, senha_nova } = req.body ?? {};
  const usuarioId = req.user?.usuario_id;

  if (!usuarioId) {
    res.status(401).json({ error: true, message: "Acesso não autorizado." });
    return;
  }

  try {
    await UsuariosService.updatePassword({
      usuarioId: req.user?.usuario_id as string,
      senhaAtual: senha_atual,
      senhaNova: senha_nova
    });
    res.status(200).json({ error: false, message: "Senha atualizada com sucesso." });
  } catch (error) {
    errorHandler(res, error, "UsuariosController");
  }
};

//  ─── Get /usuarios/stats/:usuarioId ─────────────────────────────────────────────────────
const getUserStats = async (req: request, res: response): Promise<void> => {
  const usuarioId = req.params.usuarioId;
  const empresaId = req.user?.empresaId;
  const atorId = req.user?.usuario_id;

  if (!empresaId || typeof atorId !== "string") {
    res.status(400).json({ error: true, message: "Empresa não identificada." });
    return;
  }

  if (!isUuid(usuarioId)) {
    res.status(400).json({ error: true, message: "ID do usuário inválido." });
    return;
  }

  try {
    const data = await UsuariosService.userStats({
      usuarioId,
      empresaId,
      atorId,
    });
    res.status(200).json({ error: false, data });
  } catch (error) {
    errorHandler(res, error, "UsuariosController");
  }
}

// ─── Patch /usuarios/inativar ─────────────────────────────────────────────────────
const inativarConta = async (req: request, res: response): Promise<void> => {
  const usuarioId = req.user?.usuario_id;

  if (!usuarioId) {
    res.status(401).json({ error: true, message: "Acesso não autorizado." });
    return;
  }

  try {
    await UsuariosService.inativarConta({ usuarioId });
    res.status(200).json({ error: false, message: "Conta inativada com sucesso."});
  } catch (error) {
    errorHandler(res, error, "UsuariosController");
  }
}

export default {
  getUsuarios,
  getMe,
  updatePassword,
  getUserStats,
  inativarConta
};
