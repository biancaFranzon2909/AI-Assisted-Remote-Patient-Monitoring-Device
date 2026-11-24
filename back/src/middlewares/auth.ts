import { NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "node:process";
import type { Cargos, empresa } from "@prisma/client";
import prisma from "@/prisma";

const pathsToIgnore = [
  "/auth/login",
  "/auth/refresh-token",
  "/auth/logout",
  "/auth/register",
  "/auth/password-reset",
  "/auth/password-reset-verify",
  "/health", 
];

// rotas que podem ser bypassed porem necessitam de usuario na req
const bypassWithUser: RegExp[] = [
  /^\/auth\/me$/,
  /^\/empresas\/create$/,
  /^\/empresas\/usuario\/add\/[^/]+$/i,
  /^\/convite\/aceitar\/[^/]+$/i,
]

/**
 * This function checks if the requested path and method match any of the bypass rules for authentication.
 * 
 * @param method request method
 * @param path requested path inside router assignment
 * @returns {Boolean} true if the path should bypass authentication, false otherwise
 * 
 */
const testBypassPathsWithRegex = (method: string, path: string) => {
  // Teste bypass convites
  const invitePreview = method === "GET" && /^\/convite\/aceite\/[^/]+\/?$/i.test(path);

  //teste bypass reset de senha
  const passwordVerify = method === "GET" && /^\/auth\/password-reset-verify\/[^/]+\/[^/]+$/i.test(path);
  return invitePreview || passwordVerify;
}

/**
 * Middleware de autenticação JWT
 * Verifica o token no header Authorization e adiciona o usuário ao request
 */
const authMiddleware = async (
  req: request,
  res: response,
  next: NextFunction,
): Promise<void> => {
  const path = req.path.replace(/\/$/, "").toLowerCase();
  const method = req.method;
  const bypass = await testBypassPathsWithRegex(method, path)

  try {
    const workspaceIdentificador = req.headers["x-workspace-id"];

    if (pathsToIgnore.includes(path) || bypass) {
      return next();
    }

    const JWT_SECRET = env.JWT_SECRET;
    if (!JWT_SECRET) {
      res
        .status(500)
        .json({ error: true, message: "`Secret` não configurado" });
      return;
    }

    const token = req.cookies?._tk;
    if (!token) {
      // if (invitePreview) return next();
      res.status(401).json({ error: true, message: "Token não fornecido" });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (typeof decoded === "string" || decoded.type !== "access" || typeof decoded.usuario_id !== "string" || !decoded.usuario_id) {
      // if (invitePreview) return next();
      res.status(401).json({ error: true, message: "Token inválido" });
      return;
    }

    req.user = { type: decoded.type, usuario_id: decoded.usuario_id, nome_usuario: decoded.nome_usuario };

    if (bypassWithUser.some((route) => route.test(path))) {
      return next()
    }

    if (typeof workspaceIdentificador !== "string" || !workspaceIdentificador.trim()) {
      res.status(400).json({ error: true, message: "Empresa não identificada." });
      return;
    }

    // Carregar a relação empresa.
    const [membership] = await prisma.$queryRaw<(empresa & { cargo: Cargos })[]>`
      SELECT e.id, e.identificador, e.criado_em, e.criado_por, e.nome_empresa, eu.cargo
      FROM "empresaUsuarios" AS eu
      INNER JOIN empresa AS e ON e.id = eu.empresa_id
      WHERE eu.usuario_id = ${decoded.usuario_id}::uuid
        AND e.identificador = ${workspaceIdentificador}
      LIMIT 1
    `;

    if (!membership) {
      // Preserva os status existentes.
      const company = await prisma.empresa.findUnique({
        where: { identificador: workspaceIdentificador },
        select: { id: true },
      });
      if (!company) {
        res.status(404).json({ error: true, message: "Empresa não encontrada." });
        return;
      }
      res.status(403).json({ error: true, message: "Usuário não pertence a esta empresa." });
      return;
    }

    const { id, cargo, ...data } = membership;

    // Adiciona os dados do usuário decodificados ao request
    req.user = { ...req.user, empresaId: id, empresaData: data, cargo };
    next();
    return;
  } catch (error) {
    if (bypass && error instanceof jwt.JsonWebTokenError) {
      return next();
    }
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: true, message: "Token expirado" });
      return;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: true, message: "Token inválido" });
      return;
    }
    res.status(500).json({ error: true, message: "Erro na autenticação" });
    return;
  }
};

export default authMiddleware;
