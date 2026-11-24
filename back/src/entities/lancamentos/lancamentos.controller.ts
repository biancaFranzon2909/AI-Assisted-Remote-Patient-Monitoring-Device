import { errorHandler } from "@/lib/errors/AppError";
import { isUuid } from "@/lib/utils";
import { LancamentosService } from "./lancamentos.service";

// ─── GET /lancamentos/:id ────────────────────────────────────────────────────────────
const getLancamentos = async (req: request, res: response): Promise<void> => {
  // `cargoOwner` ainda pode vir na query (front antigo), mas é ignorado: o cargo vem do banco.
  const { from, limit, projeto_id, ano, mes, dataInicio, dataFim } = req.query as { from: string; limit:string, projeto_id: string, ano?: string, mes?: string, dataInicio?: string, dataFim?: string };
  const projetoId = projeto_id || undefined;
  const empresaId = req.user?.empresaId as string;
  const lancamentoId = req.params.id as string | undefined;
  const anoNumero = Number(ano);
  const mesNumero = Number(mes);

  if (!empresaId) {
    res.status(400).json({ error: true, message: "Empresa não identificada." });
    return;
  }

  if (lancamentoId !== undefined && !isUuid(lancamentoId)) {
    res.status(400).json({ error: true, message: "ID do lançamento inválido." });
    return;
  }

  try {
    const lancamentos = await LancamentosService.find({
      empresaId,
      from: from,
      limit: limit,
      lancamentoId,
      usuarioId: req.user?.usuario_id,
      projetoId: projetoId,
      ano: Number.isInteger(anoNumero) && ano ? anoNumero : new Date().getFullYear(),
      mes: Number.isInteger(mesNumero) && mes ? mesNumero : new Date().getMonth(),
      dataInicio,
      dataFim,
    });

    res.status(200).json({ error: false, data: lancamentos });
  } catch (error) {
    errorHandler(res, error, "LancamentosController");
  }
};

// ─── GET /lancamentos/new-info ──────
/* 
Esta rota vai ser usada apenas para obter os selects para insercao de lancamentos
*/
const getNewInfoLancamentos = async (
  req: request,
  res: response,
): Promise<void> => {
  const empresaId = req.user?.empresaId as string;

  if (!empresaId) {
    res.status(400).json({ error: true, message: "Empresa não identificada." });
    return;
  }

  try {
    const newInfo = await LancamentosService.getNewInfo({
      empresaId,
      colaboradorId: req.user?.usuario_id,
    });

    res.status(200).json({ error: false, data: newInfo });
  } catch (error) {
    errorHandler(res, error, "LancamentosController.getNewInfoLancamentos");
  }
};

// ─── POST /lancamentos ────────────────────────────────────────────────────────────
const postLancamentos = async (req: request, res: response): Promise<void> => {
  const {
    atividade_id,
    cliente_id, 
    projeto_id,
    data_lancamento,
    descricao,
    hora_fim,
    hora_inicio,
    type,
  } = req.body ?? {};

  const empresaId = req.user?.empresaId as string;

  if (!empresaId) {
    res.status(400).json({ error: true, message: "Empresa não identificada." });
    return;
  }

  if (!atividade_id || !data_lancamento || !hora_inicio || !hora_fim) {
    res
      .status(400)
      .json({ error: true, message: "Dados obrigatórios ausentes." });
    return;
  }

  if (!isUuid(atividade_id) || !isUuid(projeto_id) || !isUuid(cliente_id)) {
    res
      .status(400)
      .json({ error: true, message: "Atividade, projeto ou cliente ausente ou inválido." });
    return;
  }

  try {
    await LancamentosService.create({
      empresaId,
      atividadeId: atividade_id,
      clienteId: cliente_id,
      projetoId: projeto_id,
      userId: req.user?.usuario_id,
      dataLancamento: data_lancamento,
      horaInicio: hora_inicio,
      horaFim: hora_fim,
      descricao,
    });

    res
      .status(201)
      .json({ error: false, message: "Lançamento registrado com sucesso" });
  } catch (error) {
    errorHandler(res, error, "LancamentosController.postLancamentos");
  }
};

// ─── PUT /lancamentos/:id ────────────────────────────────────────────────────────────
const putLancamentos = async (req: request, res: response): Promise<void> => {
  const id = req.params.id as string;
  const {
    descricao,
    data_lancamento,
    hora_inicio,
    hora_fim,
    motivo_edicao,
    atividade_id,
    projeto_id,
    cliente_id,
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

  if (!data_lancamento || !hora_inicio || !hora_fim) {
    res
      .status(400)
      .json({ error: true, message: "Atividade e horários são obrigatórios." });
    return;
  }

  if (!isUuid(atividade_id) || !isUuid(projeto_id) || !isUuid(cliente_id)) {
    res
      .status(400)
      .json({ error: true, message: "Atividade, projeto ou cliente ausente ou inválido." });
    return;
  }

  try {
    await LancamentosService.update({
      id,
      empresaId,
      usuarioId: req.user?.usuario_id,
      dataLancamento: data_lancamento,
      horaFim: hora_fim,
      horaInicio: hora_inicio,
      descricao,
      motivoEdicao: motivo_edicao,
      atividadeId: atividade_id,
      projetoId: projeto_id,
      clienteId: cliente_id,
    });

    res
      .status(200)
      .json({ error: false, message: "Lançamento atualizado com sucesso." });
  } catch (error) {
    errorHandler(res, error, "LancamentosController.putLancamentos");
  }
};

// ─── DELETE /lancamentos/:id ────────────────────────────────────────────────────────────
const deleteLancamentos = async (
  req: request,
  res: response,
): Promise<void> => {
  const id = req.params.id as string;
  const empresaId = req.user?.empresaId as string;

  if (!empresaId) {
    res.status(400).json({ error: true, message: "Empresa não identificada." });
    return;
  }

  if (!isUuid(id)) {
    res
      .status(400)
      .json({ error: true, message: "ID do lançamento inválido." });
    return;
  }

  try {
    await LancamentosService.remove(id, empresaId, req.user?.usuario_id);
    res
      .status(200)
      .json({ error: false, message: "Lançamento excluído com sucesso." });
  } catch (error) {
    errorHandler(res, error, "LancamentosController.deleteLancamentos");
  }
};

export default {
  getLancamentos,
  getNewInfoLancamentos,
  postLancamentos,
  putLancamentos,
  deleteLancamentos,
};
