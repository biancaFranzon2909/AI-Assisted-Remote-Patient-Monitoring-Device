-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."Cargos" AS ENUM ('OWNER', 'ADMIN', 'COLAB');

-- CreateEnum
CREATE TYPE "public"."Prioridades" AS ENUM ('BAIXA', 'NORMAL', 'ALTA', 'CRITICA');

-- CreateEnum
CREATE TYPE "public"."StatusProjeto" AS ENUM ('EmEspera', 'Orcando', 'EmAndamento', 'Finalizado', 'Cancelado');

-- CreateEnum
CREATE TYPE "public"."TipoAdministrativo" AS ENUM ('FERIAS', 'FALTA', 'EVENTO');

-- CreateEnum
CREATE TYPE "public"."TipoAtividade" AS ENUM ('ESTIMATIVA', 'ORCADO', 'INTERNO', 'CHAMADO', 'ESTUDO', 'SCC');

-- CreateEnum
CREATE TYPE "public"."TipoLancamento" AS ENUM ('MANUAL', 'CRONOMETRO');

-- CreateEnum
CREATE TYPE "public"."TipoProjeto" AS ENUM ('SCC', 'ESTIMATIVA', 'ORCADO', 'INTERNO', 'CHAMADO', 'ESTUDO');

-- CreateTable
CREATE TABLE "public"."_projetoTousuario" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_projetoTousuario_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "public"."administrativo" (
    "id" SERIAL NOT NULL,
    "empresaId" UUID NOT NULL,
    "tipo" "public"."TipoAdministrativo" NOT NULL DEFAULT 'FERIAS',
    "titulo" VARCHAR(255),
    "inicio" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fim" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" UUID,

    CONSTRAINT "administrativo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."apiKey" (
    "key" TEXT NOT NULL,
    "usuario_id" UUID NOT NULL,
    "creado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "apiKey_pkey" PRIMARY KEY ("key","usuario_id")
);

-- CreateTable
CREATE TABLE "public"."atividade" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "projeto_id" UUID NOT NULL,
    "nome_atividade" VARCHAR(100) NOT NULL,
    "descr_atividade" TEXT,
    "horas_previstas" DOUBLE PRECISION,
    "horas_gastas" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "prioridade" "public"."Prioridades" NOT NULL DEFAULT 'NORMAL',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "ref_cliente" VARCHAR(50),
    "empresa_id" UUID NOT NULL,
    "tipo" "public"."TipoAtividade" NOT NULL DEFAULT 'INTERNO',
    "data_fim" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_inicio" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "faturado" BOOLEAN NOT NULL DEFAULT false,
    "compartilhado" BOOLEAN NOT NULL DEFAULT false,
    "centro_custo" VARCHAR(20),
    "solicitante" VARCHAR(50),

    CONSTRAINT "atividade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."despesa" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lancamento_id" UUID NOT NULL,
    "nome_despesa" VARCHAR(50) NOT NULL,
    "descricao" VARCHAR(300),
    "valor" DOUBLE PRECISION NOT NULL,
    "criado_em" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "despesa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."empresa" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "identificador" VARCHAR(50) NOT NULL,
    "criado_em" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "criado_por" UUID NOT NULL,
    "nome_empresa" VARCHAR(100) NOT NULL,

    CONSTRAINT "empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."empresaUsuarios" (
    "usuario_id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "cargo" "public"."Cargos" NOT NULL DEFAULT 'COLAB',
    "criado_em" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "empresaUsuarios_pkey" PRIMARY KEY ("usuario_id","empresa_id")
);

-- CreateTable
CREATE TABLE "public"."lancamento" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "atividade_id" UUID NOT NULL,
    "data_lancamento" TIMESTAMPTZ(6) NOT NULL,
    "hora_inicio" TIME(6) NOT NULL,
    "hora_fim" TIME(6) NOT NULL,
    "descricao" TEXT,
    "criado_em" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "duracao_total" DOUBLE PRECISION,
    "tipo_lancamento" "public"."TipoLancamento" DEFAULT 'MANUAL',
    "cliente_id" UUID NOT NULL,
    "projeto_id" UUID NOT NULL,

    CONSTRAINT "lancamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."parceiro" (
    "empresa_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "cep" VARCHAR(10),
    "cidade" VARCHAR(100),
    "cnpj" VARCHAR(18) NOT NULL,
    "email" VARCHAR(100),
    "endereco" VARCHAR(100),
    "estado" CHAR(2),
    "nome_cliente" VARCHAR(50) NOT NULL,
    "parceria_id" INTEGER,
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),

    CONSTRAINT "parceiro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."parceria" (
    "id" SERIAL NOT NULL,
    "empresa_id" UUID NOT NULL,
    "empresa_parceira_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "criado_por" UUID NOT NULL,
    "is_active" BOOLEAN DEFAULT true,
    "parceiro_id" UUID NOT NULL,

    CONSTRAINT "parceria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."projeto" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nome_projeto" VARCHAR(100) NOT NULL,
    "descricao" TEXT NOT NULL,
    "data_inicio" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_fim" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "horas_previstas" DOUBLE PRECISION,
    "horas_gastas" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "ref_cliente" VARCHAR(50),
    "empresa_id" UUID NOT NULL,
    "status" "public"."StatusProjeto" NOT NULL DEFAULT 'EmAndamento',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "compartilhado" BOOLEAN NOT NULL DEFAULT false,
    "centro_custo" VARCHAR(20),
    "solicitante" VARCHAR(50),
    "tipo" "public"."TipoProjeto" NOT NULL DEFAULT 'INTERNO',
    "parceiro_id" UUID NOT NULL,

    CONSTRAINT "projeto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."relatorios_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "criado_em" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "criado_por" UUID NOT NULL,
    "filename" VARCHAR(250) NOT NULL,
    "filters" VARCHAR(100) NOT NULL,

    CONSTRAINT "relatorios_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."token" (
    "id" SERIAL NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "device_info" TEXT,
    "ip_address" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "usuario_id" UUID NOT NULL,

    CONSTRAINT "token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."usuario" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nome_usuario" VARCHAR(50) NOT NULL,
    "hash_senha" TEXT NOT NULL,
    "nome_completo" VARCHAR(100) NOT NULL,
    "email" VARCHAR(100),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "_projetoTousuario_B_index" ON "public"."_projetoTousuario"("B" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "apiKey_usuario_id_key" ON "public"."apiKey"("usuario_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "empresa_identificador_key" ON "public"."empresa"("identificador" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "empresa_nome_empresa_key" ON "public"."empresa"("nome_empresa" ASC);

-- CreateIndex
CREATE INDEX "idx_nome_cnpj_id" ON "public"."parceiro"("nome_cliente" ASC, "cnpj" ASC, "id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "parceiro_cnpj_key" ON "public"."parceiro"("cnpj" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "parceiro_email_key" ON "public"."parceiro"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "parceiro_nome_cliente_key" ON "public"."parceiro"("nome_cliente" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "parceiro_parceria_id_key" ON "public"."parceiro"("parceria_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "parceria_parceiro_id_key" ON "public"."parceria"("parceiro_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uk_empresa_empresa_parceira" ON "public"."parceria"("empresa_id" ASC, "empresa_parceira_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "token_token_hash_key" ON "public"."token"("token_hash" ASC);

-- CreateIndex
CREATE INDEX "idx_usuario_nome_usuario" ON "public"."usuario"("nome_usuario" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "public"."usuario"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_nome_usuario_key" ON "public"."usuario"("nome_usuario" ASC);

-- AddForeignKey
ALTER TABLE "public"."_projetoTousuario" ADD CONSTRAINT "_projetoTousuario_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."projeto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_projetoTousuario" ADD CONSTRAINT "_projetoTousuario_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."administrativo" ADD CONSTRAINT "administrativo_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "public"."empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."administrativo" ADD CONSTRAINT "administrativo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."apiKey" ADD CONSTRAINT "fk_key_usuario_api" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."atividade" ADD CONSTRAINT "atividade_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."atividade" ADD CONSTRAINT "fk_atividade_projeto" FOREIGN KEY ("projeto_id") REFERENCES "public"."projeto"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."despesa" ADD CONSTRAINT "despesa_lancamento_id_fkey" FOREIGN KEY ("lancamento_id") REFERENCES "public"."lancamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."empresaUsuarios" ADD CONSTRAINT "empresaUsuarios_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."empresaUsuarios" ADD CONSTRAINT "empresaUsuarios_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lancamento" ADD CONSTRAINT "fk_lancamento_atividade" FOREIGN KEY ("atividade_id") REFERENCES "public"."atividade"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."lancamento" ADD CONSTRAINT "fk_lancamento_parceiro" FOREIGN KEY ("cliente_id") REFERENCES "public"."parceiro"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."lancamento" ADD CONSTRAINT "fk_lancamento_projeto" FOREIGN KEY ("projeto_id") REFERENCES "public"."projeto"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."lancamento" ADD CONSTRAINT "fk_usuario_lancamento" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."parceiro" ADD CONSTRAINT "fk_cliente_empresa" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."parceria" ADD CONSTRAINT "fk_empresa_parceira" FOREIGN KEY ("empresa_parceira_id") REFERENCES "public"."empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."parceria" ADD CONSTRAINT "fk_parceiro_parceira" FOREIGN KEY ("parceiro_id") REFERENCES "public"."parceiro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."projeto" ADD CONSTRAINT "fk_projeto_cliente" FOREIGN KEY ("parceiro_id") REFERENCES "public"."parceiro"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."projeto" ADD CONSTRAINT "projeto_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."relatorios_log" ADD CONSTRAINT "fk_relatorio_usuario" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."token" ADD CONSTRAINT "token_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

