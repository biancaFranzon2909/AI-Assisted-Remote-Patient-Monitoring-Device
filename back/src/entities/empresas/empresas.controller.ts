import { errorHandler } from "@/lib/errors/AppError";
import { EmpresasService } from "./empresas.service";

// ─── POST /empresas/create ─────────────────────────────────────────────────────────
const postEmpresas = async (req: request, res: response) => {
  const { nomeEmpresa, identificador } = req.body ?? {};
  const ownerId = req.user?.usuario_id;

  if (!nomeEmpresa) {
    res.status(400).json({
      message: "O nome da empresa é obrigatório.",
    });
    return;
  }

  try {
    const t = await EmpresasService.create({ nomeEmpresa, identificador, ownerId });
    return res.status(201).json({data: t , message: "Empresa criada com sucesso!" });
  } catch (error) {
    return errorHandler(res, error, "EmpresasController");
  }
};

// ─── DELETE /empresas/usuario/remove ─────────────────────────────────────────────────────────
const deleteUserFromCompany = async (req: request, res: response) => {
  let userId = req.params.id as string
  let companyId = req.user?.empresaId as string;
  // Responsavel pela remocao
  let userIdRemoval = req.user?.usuario_id as string;

  try {
    const empresas = await EmpresasService.removeUserFromCompany({
      userId,
      companyId,
      userIdRemoval,
    });
    return res.status(200).json({ data: empresas });
  } catch (error) {
    return errorHandler(res, error, "EmpresasController");
  }
};

// ─── POST /empresas/usuario/add ─────────────────────────────────────────────────────────
const addUserToCompany = async (req: request, res: response) => {
  res.status(400).json({ message: "Funcao Indisponivel no momento" });
  return
  // const companyId = req.user?.empresaId;
  // const email = req.params.email as string;
  // let userId: string | undefined;
  // const userPedidoId = req.user?.usuario_id as string;

  // try {
  //   userId = (
  //     await prisma.usuario.findUnique({
  //       where: {
  //         email: email,
  //       },
  //     })
  //   )?.id

  //   if (!userId || !companyId) {
  //     res
  //       .status(400)
  //       .json({ message: "Usuário ou empresa não encontrados." });
  //     return 
  //   }
  //   if (userId !== userPedidoId) {
  //     res.status(200).json({ message: "Você não pode inserir um usuário que não seja você mesmo."})
  //   }
  // } catch (error) {
  //   return errorHandler(res, error, "EmpresasController");
  // }

  // try {
  //   await EmpresasService.addUserToCompany({
  //     userId: userId,
  //     companyId,
  //   });

  //   return res.status(200).json({ message: "Usuário adicionado à empresa com sucesso!" });
  // } catch (error) {
  //   return errorHandler(res, error, "EmpresasController");
  // }
};

// ─── DELETE /empresas/delete ─────────────────────────────────────────────────────────
const deleteCompany = async (req: request, res: response) => {
  // const { identificador } = req.body;
  const empresaId = req.user?.empresaId;
  const usuarioId = req.user?.usuario_id;

  if (!empresaId) {
    return res.status(200).json({ message: "Empresa não encontrada" });
  }

  try {
    await EmpresasService.deleteCompany({ empresaId, usuarioId });
    return res
      .status(200)
      .json({ error: false, message: "Empresa deletada com sucesso!" });
  } catch (error) {
    return errorHandler(res, error, "EmpresasController");
  }
};

export default {
  postEmpresas,
  addUserToCompany,
  deleteUserFromCompany,
  deleteCompany,
};
