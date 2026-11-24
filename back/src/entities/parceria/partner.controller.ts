import { errorHandler } from "@/lib/errors/AppError";
import { isUuid } from "@/lib/utils";
import { PartnerService } from "./partner.service";

interface bodyType { atividades?: unknown };

/** Lista de ids de atividade (uuid); `undefined` se ausente, `null` se inválida. */
const lerAtividades = (valor: unknown): string[] | undefined | null => {
  if (valor === undefined) return undefined;
  return Array.isArray(valor) && valor.every(isUuid) ? valor : null;
};

// ─── POST /partner/:projetoId/:clienteId ──────────────────────────────────────
const setCompartilhado = async (req: request, res: response): Promise<void> => {
  const { projetoId, clienteId } = req.params as { projetoId: string; clienteId: string };
  const atividades = lerAtividades(((req.body ?? {}) as bodyType).atividades);
  const empresaId = req.user?.empresaId as string;

  if (!empresaId) {
    res.status(400).json({ error: true, message: "Empresa não identificada." });
    return;
  }

  if (!isUuid(projetoId) || !isUuid(clienteId) || !atividades) {
    res.status(400).json({ error: true, message: "Parametros incorretos!" });
    return;
  }

  try {
    await PartnerService.setCompartilhado({ projetoId , clienteId, empresaId, atividades });
    res.status(200).json({ error: false, message: "Compartilhamento configurado com sucesso." });
  } catch (error) {
    errorHandler(res, error, "PartnerController.setCompartilhado");
  }
};

// ─── DELETE /partner/:projetoId/:clienteId ────────────────────────────────────
const unsetCompartilhado = async (req: request, res: response): Promise<void> => {
  const { projetoId, clienteId } = req.params as { projetoId: string; clienteId: string };
  const atividades = lerAtividades(((req.body ?? {}) as bodyType).atividades);
  const empresaId = req.user?.empresaId as string;

  if (!empresaId) {
    res.status(400).json({ error: true, message: "Empresa não identificada." });
    return;
  }

  if (!isUuid(projetoId) || !isUuid(clienteId)) {
    res.status(400).json({ error: true, message: "projetoId e clienteId são obrigatórios." });
    return;
  }

  if (atividades === null) {
    res.status(400).json({ error: true, message: "Parametros incorretos!" });
    return;
  }

  try {
    await PartnerService.unsetCompartilhado({ projetoId, clienteId, empresaId, atividades });
    res.status(200).json({ error: false, message: "Compartilhamento removido com sucesso." });
  } catch (error) {
    errorHandler(res, error, "PartnerController.unsetCompartilhado");
  }
};

export default {
  setCompartilhado,
  unsetCompartilhado,
};
