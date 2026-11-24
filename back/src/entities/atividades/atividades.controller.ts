import { errorHandler } from "@/lib/errors/AppError";
import { isUuid } from "@/lib/utils";
import { AtividadesService } from "./atividades.service";

// ── POST /atividades ─────────────────────────────────────────────────────────
const postAtividades = async (req: request, res: response): Promise<void> => {
  const {
    nome_atividade,
    prioridade,
    descr_atividade,
    data_prevista_inicio,
    data_prevista_fim,
    horas_previstas,
    ref_cliente,
    projeto_id,
    tipo_atividade,
    centro_custo,
    solicitante,
  } = req.body ?? {};

  const empresaId = req.user?.empresaId as string;

  if (!empresaId) {
    res.status(400).json({ error: true, message: "Empresa não identificada." });
    return;
  }

  try {
    await AtividadesService.create({
      empresaId,
      nomeAtividade: nome_atividade,
      prioridade: prioridade,
      descrAtividade: descr_atividade,
      dataPrevistaInicio: data_prevista_inicio,
      dataPrevistaFim: data_prevista_fim,
      horasPrevistas: Number.isNaN(horas_previstas) ? undefined : Number(horas_previstas),
      refCliente: ref_cliente,
      projetoId: projeto_id,
      tipoAtividade: tipo_atividade,
      centroCusto: centro_custo,
      solicitante,
    });
    res.status(201).json({ error: false, message: "Atividade criada com sucesso." });
  } catch (error) {
    errorHandler(res, error, "AtividadesController");
  }
};

// ─── PUT /atividades/:id ──────────────────────────────────────────────────────
const putAtividades = async (req: request, res: response): Promise<void> => {
  const { id } = req.params;
  const {
    nome_atividade,
    descr_atividade,
    tipo_atividade,
    prioridade,
    data_prevista_inicio,
    data_prevista_fim,
    horas_previstas,
    ref_cliente,
    centro_custo,
    solicitante,
    is_active,
  } = req.body ?? {};

  const empresaId = req.user?.empresaId as string;

  if (!empresaId) {
    res.status(400).json({ error: true, message: "Empresa não identificada." });
    return;
  }

  if (!isUuid(id)) {
    res.status(400).json({ error: true, message: "ID inválido." });
    return;
  }

  try {
    await AtividadesService.update({
      id: id as string,
      empresaId,
      nomeAtividade: nome_atividade,
      prioridade: prioridade,
      tipoAtividade: tipo_atividade,
      descrAtividade: descr_atividade,
      dataPrevistaInicio: data_prevista_inicio,
      dataPrevistaFim: data_prevista_fim,
      horasPrevistas: Number.isNaN(horas_previstas) ? undefined : Number(horas_previstas),
      refCliente: ref_cliente,
      centroCusto: centro_custo,
      solicitante,
      isActive: is_active,
    });
    res.status(200).json({ error: false, message: "Atividade atualizada com sucesso!" });
  } catch (error) {
    errorHandler(res, error, "AtividadesController");
  }
};

// ─── DELETE /atividades/:id ───────────────────────────────────────────────────
const deleteAtividades = async (req: request, res: response): Promise<void> => {
  const atividadeId = req.params.id as string;
  const empresaId = req.user?.empresaId as string;

  if (!isUuid(atividadeId)) {
    res.status(400).json({ error: true, message: "ID inválido." });
    return;
  }

  if (!empresaId) {
    res.status(400).json({ error: true, message: "Empresa não identificada." });
    return;
  }

  try {
    await AtividadesService.remove({ id: atividadeId, empresaId });
    res.status(200).json({ error: false, message: "Atividade excluída com sucesso." });
  } catch (error) {
    errorHandler(res, error, "AtividadesController");
  }
};

// ─── GET /atividades/:id ──────────────────────────────────────────────────────────
const getAtividades = async (req: request, res: response): Promise<void> => {
  const atividadeId = req.params.id as string | undefined;
  const empresaId = req.user?.empresaId as string;
  const usuarioId = req.user?.usuario_id as string;

  if (!empresaId) {
    res.status(400).json({ error: true, message: "Empresa não identificada." });
    return;
  }

  if (atividadeId !== undefined && !isUuid(atividadeId)) {
    res.status(400).json({ error: true, message: "ID inválido." });
    return;
  }

  try {
    const data = await AtividadesService.find({ empresaId, usuarioId, atividadeId });
    res.status(200).json({ error: false, data });
  } catch (error) {
    errorHandler(res, error, "AtividadesController");
  }
};

export default {
  postAtividades,
  putAtividades,
  deleteAtividades,
  getAtividades,
};
