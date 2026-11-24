import "dotenv/config";

import type { Server } from "node:http";
import app from "@/config/app";
import { resumoDoErro } from "@/lib/errors/AppError";
import prisma from "@/prisma";

// Tempo máximo para concluir o encerramento antes de forçar a saída
const SHUTDOWN_TIMEOUT_MS = 10_000;

let server: Server | undefined;
let encerrando = false;

const shutdown = (signal: string, exitCode = 0): void => {
  if (encerrando) return;
  encerrando = true;

  console.log(`Recebido ${signal}. Encerrando servidor...`);

  const forcarSaida = setTimeout(() => {
    console.error("Tempo limite de encerramento excedido. Forçando saída.");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forcarSaida.unref();

  const finalizar = async (): Promise<void> => {
    try {
      await prisma.$disconnect();
    } catch (error) {
      console.error("Erro ao desconectar do banco:", resumoDoErro(error));
    }
    process.exit(exitCode);
  };

  if (!server) {
    void finalizar();
    return;
  }

  server.close(() => void finalizar());
};

// Falhas não tratadas: registra e encerra de forma controlada para o PM2 reiniciar
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", resumoDoErro(reason));
  shutdown("unhandledRejection", 1);
});

process.on("uncaughtException", (error) => {
  console.error("[uncaughtException]", resumoDoErro(error));
  shutdown("uncaughtException", 1);
});

async function main() {
  await prisma.$connect();

  server = app.listen(process.env.PORT, (error?: Error) => {
    if (error) {
      console.error("[listen] Falha ao iniciar o servidor:", resumoDoErro(error));
      shutdown("listen", 1);
      return;
    }
    console.log(`Servidor iniciado em http://localhost:${process.env.PORT}`);
  });

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch(async (error) => {
  console.error("Erro ao iniciar o servidor:", resumoDoErro(error));
  await prisma.$disconnect();
  process.exit(1);
});
