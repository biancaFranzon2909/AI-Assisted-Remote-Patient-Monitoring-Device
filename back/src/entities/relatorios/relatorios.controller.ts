import { errorHandler } from "@/lib/errors/AppError";
import { RelatoriosService } from "./relatorios.service";

// ─── POST /relatorios ─────────────────────────────────────────────────────────

const relatoriosEntryPoint = async (req: request, res: response): Promise<void> => {
  const isDespesas = req.query.tipo === "despesas";
  const fileType = req.query.filext as "xlsx" | "pdf" | undefined;

  const empresaId = req.user?.empresaId as string;
  const usuarioId = req.user?.usuario_id;

  if (!empresaId) {
    res.status(400).json({ error: true, message: "Empresa não identificada." });
    return;
  }

  if (typeof usuarioId !== "string" || !usuarioId) {
    res.status(401).json({ error: true, message: "Não autenticado." });
    return;
  }

  try {
    const { result, bufferResult } = await RelatoriosService.generateReport(
      empresaId,
      usuarioId,
      req.body ?? {},
      isDespesas,
      fileType,
    );
    if (fileType && bufferResult) {
      res.setHeader("Content-Type", bufferResult.contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${bufferResult.fileName}"`);
      res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
      res.status(202).send(bufferResult.buffer);
      return;
    } else if (fileType && !bufferResult) {
      res.status(500).json({ error: true, message: "Impossível completar o arquivo!" });
      return;
    }

    res.status(202).json(result);
  } catch (error) {
    errorHandler(res, error, "RelatoriosController");
  }
};


// ─── GET /relatorios/registro ─────────────────────────────────────────────

const getRegistrosJson = async (req: request, res: response): Promise<void> => {
  try {
    const result = await RelatoriosService.getRegistrosJson(req.query, req);
    res.status(200).json(result);
  } catch (error) {
    errorHandler(res, error, "RelatoriosController.getLancamentosJsonRaw");
  }
};

export default { 
  relatoriosEntryPoint, 
  getRegistrosJson 
};
