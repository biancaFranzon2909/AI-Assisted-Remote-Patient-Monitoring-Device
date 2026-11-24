import express, { Request } from "express";
import router from "@/router";
import authMiddleware from "@/middlewares/auth";
import verifyRole from "@/middlewares/verifyRole";
import cors, { CorsOptions, CorsOptionsDelegate, CorsRequest } from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import requestIdMiddleware from "@/middlewares/requestId";
import errorMiddleware, { notFoundMiddleware } from "@/middlewares/errorMiddleware";
import {
  loginLimiter,
  passwordResetLimiter,
  passwordResetVerifyLimiter,
  refreshTokenLimiter,
  registerLimiter,
} from "@/middlewares/rateLimit";

//types global
import "@/types";

const app = express();

app.set("trust proxy", true);

// Cabeçalhos de segurança. CORP "cross-origin": o front (outra origem) consome JSON e baixa XLSX via fetch.
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

// Identificador da requisição (req.requestId + header X-Request-Id)
app.use(requestIdMiddleware);

// 1. configurar o cors
const dynamicOrigins: CorsOptionsDelegate<Request> = (req, callback) => {
  let corsOptions: CorsOptions = {
    origin: [
      "http://localhost:5174",
      "http://localhost:5173",
      "http://10.1.1.201:5174",
      "http://10.1.1.180:5177",
      "https://chronotracker.sinosbyte.com.br",
      "https://chrono-hml.sinosbyte.com.br"
    ],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "x-workspace-id"],
  };

  callback(null, corsOptions);
};
app.use(cors(dynamicOrigins));

// 2. parse dos cookies + ajuste para as apis expostas com rateLimiting
app.use(cookieParser());

app.use("/api", (req, _res, next) => {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    req.cookies = req.cookies ?? {};
    req.cookies._tk = auth.slice(7);
  }
  next();
});

// Limite de requisições nas rotas sensíveis sem login (antes de ler o corpo).
// `/convite/create` é limitado por usuário na própria rota (src/router/index.ts), depois do authMiddleware.
app.post("/auth/login", loginLimiter);
app.post("/auth/register", registerLimiter);
app.post("/auth/password-reset", passwordResetLimiter);
app.post("/auth/password-reset-verify", passwordResetVerifyLimiter);
app.post("/auth/refresh-token", refreshTokenLimiter);

//3. config do express se precisar
app.use(express.json({ limit: "1mb" }));

//4. middlewares de autenticacao e etc...
app.use(authMiddleware); // Middleware de autenticação
// app.use(verifyRole); //Controla o acesso dos Cargos (RBAC)

//5. Assinaturas de rotas
app.use(router);

//6. Rota inexistente: 404 em JSON
app.use(notFoundMiddleware);

//7. Erros não tratados (JSON malformado, corpo grande, exceções): sempre depois do router
app.use(errorMiddleware);
export default app;