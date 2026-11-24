import { NextFunction, Request, Response } from "express";
import { Cargos, empresa } from "@prisma/client";
import { JwtPayload } from "jsonwebtoken";

// Extended global types, interfaces or variables can be declared here
declare global {
  namespace Express {
    interface Request {
      /** Identificador da requisição (src/middlewares/requestId.ts), também no header `X-Request-Id`. */
      requestId?: string;
      /**
       * A propriedade `user` NAO é opcional e contem informações do usuário autenticado
       * @ src\middlewares\auth.ts
       */
      user?: JwtPayload & { 
        empresaId?: string 
        empresaData?: Partial<empresa>
        cargo?: Cargos
      };
    }
  }

  // Deixar aqui (debito tecnico) - facilita erros
  type request = Request;
  type response = Response;
  type next = NextFunction;

  //usado no login
  interface Usuario {
    id: string;
    nome_usuario: string;
  }

  //tipo de retorno reutilizavel
  interface Returnable {
    data?: any, 
    error: boolean, 
    message?: string
  }
}

export {};
