import { errorHandler } from "@/lib/errors/AppError";
import { isUuid } from "@/lib/utils";
import { ClientesService } from "./clientes.service";

// ─── GET /clientes/list/:id ───────────────────────────────────────────────────────

const getClientes = async (req: request, res: response): Promise<void> => {
  const { is_active } = req.query;
  const clienteId = (req.params.id as string) || undefined;

  if (clienteId !== undefined && !isUuid(clienteId)) {
    res.status(400).json({ error: true, message: "ID do cliente inválido." });
    return;
  }

  try {
    const data = await ClientesService.find({
      is_active: is_active as string,
      clienteId,
      empresaId: req.user?.empresaId as string,
      usuarioId: req.user?.usuario_id as string,
    });
    res.status(200).json({ error: false, data });
  } catch (error) {
    errorHandler(res, error, "ClientesController");
  }
};

// ─── POST /clientes/create ───────────────────────────────────────────────────────────

const postClientes = async (req: request, res: response): Promise<void> => {
  const {
    cep,
    cidade,
    cliente_id,
    cnpj,
    email,
    endereco,
    estado,
    inscricao_estadual,
    nome_fantasia,
    nota_interna,
    pais,
    razao_social,
    status,
    website,
  } = req.body ?? {};

  if (!cnpj || !razao_social) {
    res.status(400).json({
      error: true,
      message: "CNPJ e Razão Social são obrigatórios.",
    });
    return;
  }

  try {
    const cliente = await ClientesService.create({
      nomeFantasia: nome_fantasia ?? "",
      empresaId: req.user?.empresaId as string,
      cnpj,
      email,
      cep,
      endereco,
      cidade,
      estado,
      inscricaoEstadual: inscricao_estadual,
      notaInterna: nota_interna,
      pais,
      razaoSocial: razao_social,
      website,
    });
    res.status(201).json({ error: false, data: { cliente } });
  } catch (error) {
    errorHandler(res, error, "ClientesController");
  }
};

// ─── PUT /clientes/edit/:id ────────────────────────────────────────────────────────

const putClientes = async (req: request, res: response): Promise<void> => {
  const {
    cep,
    cidade,
    cliente_id,
    cnpj,
    email,
    endereco,
    estado,
    inscricao_estadual,
    nome_fantasia,
    nota_interna,
    pais,
    razao_social,
    status,
    website,
    identificador_parceiro,
  } = req.body ?? {};
  const empresaId = req.user?.empresaId as string;
  const clienteId = req.params.id as string;

  if (!empresaId) {
    res.status(400).json({ error: true, message: "Empresa não identificada." });
    return;
  }

  if (!isUuid(clienteId)) {
    res.status(400).json({ error: true, message: "ID do cliente inválido." });
    return;
  } 
  try {
    const cliente = await ClientesService.update({
      id: clienteId,
      userId: req.user?.usuario_id,
      empresaId,
      cnpj,
      nomeFantasia: nome_fantasia,
      email,
      cep,
      endereco,
      cidade,
      estado,
      inscricaoEstadual: inscricao_estadual,
      notaInterna: nota_interna,
      pais,
      razaoSocial: razao_social,
      website,
      status: status,
      identificadorParceria: identificador_parceiro
        ? identificador_parceiro
        : null,
    });
    res.status(200).json({ error: false, data: { cliente } });
  } catch (error) {
    errorHandler(res, error, "ClientesController");
  }
};

// ─── DELETE /clientes/delete/:id ─────────────────────────────────────────────────────

const deleteClientes = async (req: request, res: response): Promise<void> => {
  const clienteId = req.params.id as string;
  const empresaId = req.user?.empresaId as string;

  if (!empresaId) {
    res.status(400).json({ error: true, message: "Empresa não identificada." });
    return;
  }

  if (!isUuid(clienteId)) {
    res.status(400).json({ error: true, message: "ID do cliente inválido." });
    return;
  }

  try {
    await ClientesService.remove({ id: clienteId, empresaId });
    res
      .status(200)
      .json({ error: false, message: "Cliente excluído com sucesso." });
  } catch (error) {
    errorHandler(res, error, "ClientesController");
  }
};

// ─── GET /clientes/:id/projetos ───────────────────────────────────────────────

const getClienteProjetos = async (
  req: request,
  res: response,
): Promise<void> => {
  const clienteId = req.params.id as string;
  const empresaId = req.user?.empresaId as string;

  if (!empresaId) {
    res.status(400).json({ error: true, message: "Empresa não identificada." });
    return;
  }

  if (!isUuid(clienteId)) {
    res.status(400).json({ error: true, message: "ID do cliente inválido." });
    return;
  }

  try {
    const projetos = await ClientesService.findProjetos({
      id: clienteId,
      empresaId,
    });
    res.status(200).json({ error: false, data: { projetos } });
  } catch (error) {
    errorHandler(res, error, "ClientesController");
  }
};

export default {
  getClientes,
  postClientes,
  putClientes,
  deleteClientes,
  getClienteProjetos,
};
