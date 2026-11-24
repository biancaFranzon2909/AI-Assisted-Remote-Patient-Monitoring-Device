import { NextFunction } from "express";

//decidir cada feature a ser controlada a partir dai teremos as apis mapeadas
const PATHS_ROLES = {
  "/usuarios": ["admin"],
};

const verifyRole = (req: request, res: response, next: NextFunction): void => {
  if (req.path.includes("/login")) {
    next();
    return;
  }

  const userCargo = req.user?.cargo as string | undefined;
  if (!userCargo) {
    res
      .status(403)
      .json({ error: true, message: "Cargo do usuário não encontrado" });
    return;
  }

  // FEIO DEMAIS, MAS FUNCIONA, SO PRA TER UM CONTROLE DE
  // ACESSO MAIS ATOMICO, POIS O JWT SO TRAZ O CARGO,
  // E NAO AS PERMISSOES EXATAS DO USUÁRIO
  const firstPartOfPath =
    (req.path.includes("?")
      ? req.path.split("?")[0].split("/")[1]
      : req.path.split("/").filter((item) => item.length > 1)[0]) ?? "";

  const pathKey = `/${firstPartOfPath}`;
  const allowedRoles = PATHS_ROLES[pathKey as keyof typeof PATHS_ROLES];

  if (allowedRoles && !allowedRoles.includes(userCargo)) {
    res.status(403).json({ error: true, message: "Acesso negado" });
    return;
  }

  next();
};

export default verifyRole;
