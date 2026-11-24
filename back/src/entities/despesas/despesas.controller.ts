import { errorHandler} from "@/lib/errors/AppError";
import { isUuid } from "@/lib/utils";
import { DespesasService } from "./despesas.service";

// ─── GET /despesas/lancamentos/dia ───────────────────────────────
const getLancamentosDoDia = async (req: request, res: response): Promise<void> => {
  const { data } = req.query
  const colaborador_id = req.user?.usuario_id
  const empresaId = req.user?.empresaId as string

  if (!data) {
    res.status(400).json({ error: true, message: "Data é obrigatória." })
    return
  }

  if (!colaborador_id || !empresaId) {
    res.status(400).json({ error: true, message: "Usuário ou empresa não identificados." })
    return
  }

  try {
    const lancamentos = await DespesasService.buscarLancamentosPorData({
      empresaId,
      colaboradorId: colaborador_id,
      data: data as string,
    })

    res.status(200).json({ error: false, data: lancamentos })
  } catch (error) {
    errorHandler(res, error, "DespesasController")
  }
}

// ─── POST /despesas ───────────────────────────────────────────────────────────
const postDespesas = async (req: request, res: response): Promise<void> => {
  const { nome_despesa, descricao, valor, data_despesa, lancamento_id } = req.body ?? {};
  const colaborador_id = req.user?.usuario_id;
  const empresaId = req.user?.empresaId as string;

  if (!nome_despesa || !valor || !data_despesa) {
    res.status(400).json({
      error: true,
      message: "Nome da despesa, valor e data são obrigatórios.",
    });
    return;
  }

  if (!colaborador_id) {
    res.status(400).json({ error: true, message: "Colaborador não encontrado." });
    return;
  }

  if (lancamento_id && !isUuid(lancamento_id)) {
    res.status(400).json({ error: true, message: "Lançamento inválido." });
    return;
  }

  try {
    await DespesasService.create({
      empresaId,
      nomeDespesa: nome_despesa,
      descricao,
      valor: Number(valor),
      dataDespesa: data_despesa,
      colaboradorId: colaborador_id,
      lancamentoId: lancamento_id,
    });

    res.status(201).json({ error: false, message: "Despesa adicionada!" });
  } catch (error) {
    errorHandler(res, error, "DespesasController");
  }
};

// ─── GET /despesas ────────────────────────────────────────────────────────────

const getDespesas = async (req: request, res: response): Promise<void> => {
  const { data_inicio, data_fim } = req.query;
  const colaborador_id = req.user?.usuario_id;
  const empresaId = req.user?.empresaId as string;

  if (!empresaId) {
    res.status(400).json({ error: true, message: "Empresa não identificada." });
    return;
  }

  if (!colaborador_id) {
    res.status(400).json({ error: true, message: "Colaborador não encontrado." });
    return;
  }

  try {
    const despesas = await DespesasService.findMany({
      colaboradorId: colaborador_id,
      dataInicio: data_inicio as string | undefined,
      dataFim: data_fim as string | undefined,
      empresaId: empresaId,
    });

    res.status(200).json({ error: false, data: despesas });
  } catch (error) {
    errorHandler(res, error, "DespesasController");
  }
};

// ─── DELETE /despesas/:id ─────────────────────────────────────────────────────

const deleteDespesas = async (req: request, res: response): Promise<void> => {
  const despesaId = req.params.id as string;
  const empresaId = req.user?.empresaId as string;

  if (!despesaId) {
    res.status(400).json({ error: true, message: "ID da despesa é obrigatório." });
    return;
  }

  if (!empresaId) {
    res.status(400).json({ error: true, message: "Empresa não identificada." });
    return;
  }

  if (!isUuid(despesaId)) {
    res.status(400).json({ error: true, message: "ID da despesa inválido." });
    return;
  }

  try {
    await DespesasService.remove({ id: despesaId, empresaId, usuarioId: req.user?.usuario_id });
    res.status(200).json({ error: false, message: "Despesa deletada com sucesso." });
  } catch (error) {
    errorHandler(res, error, "DespesasController");
  }
};

export default { postDespesas, getDespesas, deleteDespesas, getLancamentosDoDia };