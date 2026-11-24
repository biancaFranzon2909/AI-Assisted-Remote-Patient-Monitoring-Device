import { TipoAdministrativo } from "@prisma/client";
import { errorHandler } from "@/lib/errors/AppError";
import { isUuid } from "@/lib/utils";
import { AdministrativoService } from "./administrativo.service";

/** `usuarioId` do corpo é opcional; se vier, precisa ser um uuid. */
const usuarioIdInvalido = (usuarioId: unknown): boolean =>
  usuarioId !== undefined && usuarioId !== null && !isUuid(usuarioId);

/** Converte a data do corpo; `null` se ausente ou inválida. */
const lerData = (valor: unknown): Date | null => {
  if (typeof valor !== "string" && typeof valor !== "number") return null;
  const data = new Date(valor);
  return isNaN(data.getTime()) ? null : data;
};

const tipoInvalido = (tipo: unknown): boolean =>
  tipo !== undefined &&
  !Object.values(TipoAdministrativo).includes(tipo as TipoAdministrativo);

/** `titulo` precisa ser texto de até 255 caracteres (coluna VarChar(255)). */
const tituloInvalido = (titulo: unknown): boolean =>
  typeof titulo !== "string" || titulo.length > 255;

// ── POST /administrativo ─────────────────────────────────────────────────────────
const postAdministrativo = async (req: request, res: response): Promise<void> => {
  const {
    tipo,
    titulo,
    usuarioId,
    data_inicio,
    data_fim,
  } = req.body ?? {};
  const empresaId = req.user?.empresaId as string;

  if (!empresaId) {
    res.status(400).json({ error: true, message: "Empresa não identificada." });
    return;
  }

  if (tituloInvalido(titulo)) {
    res.status(400).json({ error: true, message: "Título inválido." });
    return;
  }

  if (usuarioIdInvalido(usuarioId)) {
    res.status(400).json({ error: true, message: "Usuário inválido." });
    return;
  }

  const dataInicio = lerData(data_inicio);
  const dataFim = lerData(data_fim);
  if (!dataInicio || !dataFim) {
    res.status(400).json({ error: true, message: "Datas inválidas." });
    return;
  }

  if (tipoInvalido(tipo)) {
    res.status(400).json({ error: true, message: "Tipo de evento inválido." });
    return;
  }

  try {
    const ret = await AdministrativoService.create({
      tipo,
      titulo,
      data_inicio: dataInicio,
      data_fim: dataFim,
      usuarioId: usuarioId ?? req.user?.usuario_id,
      empresaId,
    });

    res.status(201).json({ error: false, message: "Evento inserido com sucesso.", data: ret});
  } catch (error) {
    errorHandler(res, error, "AdministrativoController");
  }
};

// PUT /administrativo ─────────────────────────────────────────────────────────
const putAdministrativo = async (req: request, res: response): Promise<void> => {
  // `empresaId` do corpo é descartado: o escopo vem sempre do usuário autenticado
  const { tipo, titulo, usuarioId, data_inicio, data_fim } = req.body ?? {};
  const empresaId = req.user?.empresaId as string;
  const id = req.params?.id as string

  if (!empresaId) {
    res.status(400).json({ error: true, message: "Empresa não identificada." });
    return;
  }

  if (!isUuid(id)) {
    res.status(400).json({ error: true, message: "ID do evento inválido." });
    return;
  }

  if (titulo !== undefined && tituloInvalido(titulo)) {
    res.status(400).json({ error: true, message: "Título inválido." });
    return;
  }

  if (usuarioIdInvalido(usuarioId)) {
    res.status(400).json({ error: true, message: "Usuário inválido." });
    return;
  }

  // Só os campos presentes no corpo são alterados; sem `usuarioId`, o responsável atual é mantido
  const dataInicio = data_inicio === undefined ? undefined : lerData(data_inicio);
  const dataFim = data_fim === undefined ? undefined : lerData(data_fim);
  if (dataInicio === null || dataFim === null) {
    res.status(400).json({ error: true, message: "Datas inválidas." });
    return;
  }

  if (tipoInvalido(tipo)) {
    res.status(400).json({ error: true, message: "Tipo de evento inválido." });
    return;
  }

  try {
    const ret = await AdministrativoService.update({
      id,
      tipo,
      titulo,
      data_inicio: dataInicio,
      data_fim: dataFim,
      usuarioId: usuarioId ?? undefined,
      empresaId,
    });

    res.status(200).json({ error: false, message: "Evento atualizado com sucesso.", data: ret });
  } catch (error) {
    errorHandler(res, error, "AdministrativoController");
  }
};

// ── DELETE /administrativo/:id ─────────────────────────────────────────────────────────
const removeAdministrativo = async (req: request, res: response): Promise<void> => {
  const id = req.params?.id as string
  const empresaId = req.user?.empresaId as string;

  if (!empresaId) {
    res.status(400).json({ error: true, message: "Empresa não identificada." });
    return;
  }

  if (!isUuid(id)) {
    res.status(400).json({ error: true, message: "ID do evento inválido." });
    return;
  }

  try {
    await AdministrativoService.remove({ id, empresaId });
    res.status(200).json({ error: false });
  } catch (error) {
    errorHandler(res, error, "AdministrativoController");
  }
}

// ── GET /administrativo ─────────────────────────────────────────────────────────
const getAdministrativo = async (req: request, res: response): Promise<void> => {
  const empresaId = req.user?.empresaId as string;
  const usuarioId = req.user?.usuario_id as string;

  if (!empresaId) {
    res.status(400).json({ error: true, message: "Empresa não identificada." });
    return;
  }

  try {
    const eventos = await AdministrativoService.findMany({ empresaId, usuarioId });
    res.status(200).json({ error: false, data: eventos });
  } catch (error) {
    errorHandler(res, error, "AdministrativoController");
  }

}


export default {
  postAdministrativo,
  putAdministrativo,
  getAdministrativo,
  removeAdministrativo
};
