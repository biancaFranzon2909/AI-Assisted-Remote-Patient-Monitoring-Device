import { errorHandler } from "@/lib/errors/AppError";
import { isUuid } from "@/lib/utils";
import { ProjetosService } from "./projetos.service";

// ─── GET /projetos/:id ─────────────────────────────────────────────────────────

const getProjetos = async (req: request, res: response): Promise<void> => {
  const projetoId = req.params.id as string || undefined
  const empresaId = req.user?.empresaId as string

  if (projetoId !== undefined && !isUuid(projetoId)) {
    res.status(400).json({ error: true, message: "ID do projeto inválido." });
    return;
  }

  try {
    const projetos = await ProjetosService.find({projetoId, empresaId});
    res.status(200).json({ error: false, data: projetos });
  } catch (error) {
    errorHandler(res, error, "ProjetosController");
  }
};

// ─── POST /projetos ───────────────────────────────────────────────────────────

const postProjetos = async (req: request, res: response): Promise<void> => {
  const {
    cliente_id,
    nome_projeto,
    descricao,
    ref_cliente,
    data_inicio,
    data_fim,
    status, 
    horas_previstas,
    equipe,
    centro_custo,
    solicitante,
    tipo,
  } = req.body ?? {};

  if (!nome_projeto || !data_inicio || !data_fim) {
    res.status(400).json({
      error: true,
      message: "Campos obrigatórios: Nome, Data Início, Data Fim.",
    });
    return;
  }

  const empresaId = req.user?.empresaId as string;

  if (!empresaId) {
    res.status(400).json({ error: true, message: "Empresa não identificada." });
    return;
  }
  try {
    await ProjetosService.create({
      empresaId,
      clienteId: cliente_id,
      nomeProjeto: nome_projeto,
      descricao,
      refCliente: typeof ref_cliente === "string" && ref_cliente.length > 0 ? ref_cliente : undefined,
      dataInicio: data_inicio,
      dataFim: data_fim,
      horasPrevistas: Number.isNaN(Number(horas_previstas)) ? null : Number(horas_previstas),
      status, 
      equipe,
      centroCusto: centro_custo,
      solicitante,
      tipoProjeto: tipo,
    });
    res.status(201).json({ error: false, message: "Projeto criado com sucesso." });
  } catch (error) {
    errorHandler(res, error, "ProjetosController");
  }
};

// ─── PUT /projetos/:id ────────────────────────────────────────────────────────

const putProjetos = async (req: request, res: response): Promise<void> => {
  const { id } = req.params;
  const {
    clienteId,
    nome_projeto,
    descricao,
    data_inicio,
    data_fim,
    status,
    horas_previstas,
    equipe,
    ref_cliente,
    centro_custo,
    solicitante,
    tipo,
    is_active,
  } = req.body ?? {};
  const empresaId = req.user?.empresaId as string;

  if (!empresaId) {
    res.status(400).json({ error: true, message: "Empresa não identificada." });
    return;
  }

  if (!isUuid(id)) {
    res.status(400).json({ error: true, message: "ID do projeto inválido." });
    return;
  }

  try {
    await ProjetosService.update({
      id,
      empresaId,
      clienteId,
      nomeProjeto: nome_projeto,
      descricao,
      refCliente: ref_cliente,
      dataInicio: data_inicio,
      dataFim: data_fim,
      status,
      horasPrevistas: Number.isNaN(Number(horas_previstas)) ? null : Number(horas_previstas),
      equipe,
      centroCusto: centro_custo,
      solicitante,
      tipoProjeto: tipo,
      isActive: is_active,
    });
    res.status(200).json({ error: false, message: "Projeto atualizado com sucesso." });
  } catch (error) {
    errorHandler(res, error, "ProjetosController");
  }
};

// ─── DELETE /projetos/:id ─────────────────────────────────────────────────────

const deleteProjetos = async (req: request, res: response): Promise<void> => {
  const { id } = req.params;
  const empresaId = req.user?.empresaId as string;

  if (!isUuid(id)) {
    res.status(400).json({ error: true, message: "ID do projeto inválido." });
    return;
  }

  if (!empresaId) {
    res.status(400).json({ error: true, message: "Empresa não identificada." });
    return;
  }

  try {
    await ProjetosService.remove({ id, empresaId });
    res.status(200).json({ error: false, message: "Projeto excluído com sucesso." });
  } catch (error) {
    errorHandler(res, error, "ProjetosController");
  }
};

export default {
  getProjetos,
  postProjetos,
  putProjetos,
  deleteProjetos,
};
