// src/prisma/index.ts
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import { env } from "node:process";

const dbPoolMax = Number(env.DB_POOL_MAX ?? "10");
const idleTimeoutMs = Number(env.IDLE_TIMEOUT_MS ?? "30000");
const connectionTimeoutMs = Number(env.CONNECTION_TIMEOUT_MS ?? "5000");

if (!Number.isFinite(dbPoolMax) || !Number.isInteger(dbPoolMax) || dbPoolMax <= 0) {
  throw new Error("DB_POOL_MAX deve ser um inteiro positivo finito. Padrão quando não definido: 10.");
}
if (!Number.isFinite(idleTimeoutMs) || !Number.isInteger(idleTimeoutMs) || idleTimeoutMs <= 0) {
  throw new Error("IDLE_TIMEOUT_MS deve ser um inteiro positivo finito. Padrão quando não definido: 30000.");
}
if (!Number.isFinite(connectionTimeoutMs) || !Number.isInteger(connectionTimeoutMs) || connectionTimeoutMs <= 0) {
  throw new Error("CONNECTION_TIMEOUT_MS deve ser um inteiro positivo finito. Padrão quando não definido: 5000.");
}

const adapter = new PrismaNeon({
  connectionString: env.DATABASE_URL,
  max: dbPoolMax,
  idleTimeoutMillis: idleTimeoutMs,
  connectionTimeoutMillis: connectionTimeoutMs,
});

// errorFormat "minimal": mensagens de erro do Prisma sem o trecho da consulta (que pode ter dados pessoais)
const prisma = new PrismaClient({
  adapter,
  errorFormat: "minimal",
});

export default prisma;