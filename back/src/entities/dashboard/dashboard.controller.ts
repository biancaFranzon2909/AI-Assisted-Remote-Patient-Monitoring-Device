import { errorHandler } from "@/lib/errors/AppError";
import { DashboardService } from "./dashboard.service";

const getStats = async (req: request, res: response): Promise<void> => {
  const usuarioId = req.user?.usuario_id;
  const empresaId = req.user?.empresaId;
  const cargo = req.user?.cargo;
  const workspaceId = req.user?.empresaData?.identificador;

  if (!usuarioId || !empresaId || !cargo || !workspaceId) {
    res.status(400).json({ error: true, message: "Usuário ou empresa não identificados." });
    return;
  }

  try {
    const data = await DashboardService.getStats(usuarioId, empresaId, cargo, workspaceId);
    res.status(200).json({
      error: false,
      message: "Dashboard carregado.",
      data,
    });
  } catch (error) {
    errorHandler(res, error, "DashboardController");
  }
};

export default { getStats };
